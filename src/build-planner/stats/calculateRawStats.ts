import type { Profession, ProfessionTypeKey } from '../profession';
import {
  classifyEvoDisplay,
  type FixedEvoEffect,
  getMaxPerfectline,
  getTalentSchoolId,
} from '../equipment/equipmentData';
import type {
  CookingBuffState,
  EquipmentSlotId,
  EquippedItems,
  LegendaryAffixSelection,
  ModuleSlots,
  SlotEnchants,
  SlotEvolutionStats,
  SlotLegendaryAffixGroups,
  SlotRefineLevels,
  StatId,
} from '../types';
import type { PhantomFactorSlotValue } from '../phantom/phantomData';
import {
  CURRENT_FACTOR_SEASON_ID,
  getActivePhantomNodeIds,
  getUnlockLevel,
  pfData as phantomFactorData,
  stData as seasonTalentData,
} from '../phantom/phantomData';
import { BASE_STATS } from './baseStats';
import {
  calcLuckyCritBonus,
  calcStatResonanceBonus,
  INSPIRATION_VALUES,
  POWER_CORE_EFFECT_IDS,
} from './cookingBuff';
import {
  AFFIX_STAT_EFFECTS,
  BOND_BUFF_STAT_EFFECTS,
  ELEMENT_ATTR_STR_STAT,
  ENCHANT_ATTR_TO_STAT,
  EQUIP_ATTR_TO_STAT,
  EVO_ATTR_TO_STAT,
  EVO_PCT_ATTR_TO_STAT,
  EVO_PCT_FINAL_ATTR_TO_STAT,
  FACTOR_POLARITY_EFFECTS,
  IMAGINE_BUF_FLAT_STAT,
  IMAGINE_FLAT_STAT,
  IMAGINE_PCT_BASE,
  IMAGINE_PCT_FINAL,
  IMAGINE_RAW_PERCENT_STAT,
  type ImagineFinalStatId,
  LEGENDARY_AFFIX_FLAT_STAT,
  MOD_ADAPTIVE_ATK_ATTR_ID,
  MOD_ADAPTIVE_MAIN_STAT_ATTR_ID,
  MOD_ATTR_TO_STAT,
  MOD_CAST_SPEED_FINAL_PCT_ATTR_ID,
  MOD_EFFECT_TYPE_ADAPTIVE,
  MOD_EFFECT_TYPE_STAT,
  ORDINARY_EFFECT_BONUS,
  PHANTOM_ATTR_TO_STAT,
  PHANTOM_EFFECT_TYPE_POLARITY,
  PHANTOM_EFFECT_TYPE_STAT,
  PHANTOM_LEVEL_ATTR_TO_STAT,
  REFINE_ATK_ATTR_ID,
  REFINE_DEF_ATTR_ID,
  REFINE_ENDURANCE_ATTR_ID,
  REFINE_MATK_ATTR_ID,
  TALENT_ATK_SPEED_FINAL_PCT_ATTR_ID,
  TALENT_ATTR_TO_STAT,
  TALENT_BASE_PCT_TO_STAT,
  TALENT_EFFECT_TYPE_CONVERSION_RATE,
  TALENT_EFFECT_TYPE_FLAT_STAT,
  TALENT_EFFECT_TYPE_TYPE1_FINAL_PCT,
  TALENT_FINAL_PCT_ADDEND_TO_STAT,
  TALENT_FLAT_PCT_TO_STAT,
  TALENT_HIGHEST_OF_FINAL_PCT,
  TALENT_LUCKY_HIT_DAMAGE_RATIO_BONUS,
  TALENT_RAW_FLAT_TO_STAT,
  TALENT_TYPE1_ONLY_FINAL_PCT,
} from './attrMaps';
import {
  calcModuleEffectLevels,
  enchantEffectsById,
  getPowerCoreLevel,
  imagineDataById,
  levelCumulativeData,
  modulesData,
  playerLevelSeasonData,
  refineData,
  talentTree,
  type TalentTreeNode,
} from './gameData';
import { calcStatValue } from './statValue';
import { convertBySeparatelyTruncatedRates, type DerivedStats } from './deriveStats';
import { calcGlobalLink } from '../module/moduleData';
import { COMMON_STAT_COEFFICIENTS } from './commonCoefficients';

// %ボーナスの内部表現の基数(1万 = 100%。例: rawValue=1500 → 15%)。
const PERCENT_BASIS_POINTS = 10000;

// 浮動小数点演算の誤差(例: 15%のつもりが14.999999...%になる)を吸収するため、
// 十分な精度で四捨五入してから使う。バフ効果同士を合算する際の中間計算に使う。
const ROUNDING_SCALE = 1e6;
function roundClean(value: number): number {
  return Math.round(value * ROUNDING_SCALE) / ROUNDING_SCALE;
}

// 小数点第三位を切り捨てて第二位までに丸める。最終的なステータス計算結果にのみ使う。
// value*100 の時点でも浮動小数点誤差(例: 4.6*100が459.999...になる)が起きうるため、
// floorする直前にもroundCleanで丸める。
function truncate2(value: number): number {
  return Math.floor(roundClean(value * 100)) / 100;
}

// 整数へ切り捨てる。ゲーム内はステータス実数値を表示・後続計算とも常に整数として扱う
// (2026-08-06不具合報告: 知力2249.28→魔法攻撃力/ファスト実数の計算が浮動小数点のまま
// 進んでいたため、複数のビルドで実測値と1〜数ポイントのズレが生じていた)。floorする直前にも
// roundCleanで丸める(truncate2と同じ理由)。
function truncateInt(value: number): number {
  return Math.floor(roundClean(value));
}

// 整数へ四捨五入する。floorする直前にもroundCleanで丸める(truncateIntと同じ理由)。
// 収益逓減カーブの対象になる会心/ファスト/幸運/器用さ/万能(PCT_BONUS_ROUNDED_STAT_IDS)に
// %ボーナス(潜在因子の極性バフ等)を乗算する箇所限定で使う(2026-09-02/03不具合報告: 幸運
// 29,040に極性因子+7.83%適用後の実測値31,314は、floor(31313.832)の31313ではなく
// 四捨五入のround(31313.832)=31314と一致。別の実測28,329×1.0783=30,547.1607→実測30547も
// round()と一致(floor()でも同じ結果になるため単独では判別できないが、前者の実測と合わせて
// 四捨五入と判断)。メインステータス(筋力/知力/敏捷)は同じ%ボーナス適用処理でもfloorのまま
// (2026-08-06不具合報告: 知力15×1.05=15.75→実測15。round()なら16になり実測と食い違うため、
// この2種の丸め方式は統一しない)。
function roundToInt(value: number): number {
  return Math.round(roundClean(value));
}

// ゲーム内で常に整数として扱われることが実測で確認できているStatId(2026-08-06不具合報告)。
// 会心/ファスト/幸運/器用さ/万能(INSPIRATION_PERCENT_STAT_IDSと同じ5種)とメインステータス
// (筋力/知力/敏捷)が対象。他のStatId(耐久力・防御力・属性系等)は未検証のため、当面は
// 従来通りtruncate2(小数点2桁切り捨て)のままとする。
const INTEGER_TRUNCATED_STAT_IDS = new Set<StatId>([
  'strength',
  'intellect',
  'agility',
  'crit',
  'haste',
  'luck',
  'mastery',
  'versatility',
]);

// INTEGER_TRUNCATED_STAT_IDSのうち、%ボーナス適用時の丸めがfloorではなくround(四捨五入)と
// 実測確認できているStatId(roundToIntのコメント参照)。収益逓減カーブの対象になる5種のみで、
// メインステータス(筋力/知力/敏捷)は含まない。
const PCT_BONUS_ROUNDED_STAT_IDS = new Set<StatId>([
  'crit',
  'haste',
  'luck',
  'mastery',
  'versatility',
]);

export interface CalculateRawStatsInput {
  equipped: EquippedItems;
  legendaryAffixState: Partial<Record<EquipmentSlotId, LegendaryAffixSelection | undefined>>;
  legendaryAffixGroupState: SlotLegendaryAffixGroups;
  refineLevels: SlotRefineLevels;
  perfectlines: SlotRefineLevels;
  evolutionStats: SlotEvolutionStats;
  profession: Profession;
  professionTypeKey: ProfessionTypeKey;
  talentR1EnabledIds: Set<number>;
  talentR2EnabledIds: Set<number>;
  talentNodesById: Map<number, TalentTreeNode>;
  r1NodeCount: number;
  battleImagines: (number | null)[];
  imagineRanks: number[];
  slotEnchants: SlotEnchants;
  moduleSlots: ModuleSlots;
  adventurerLevel: number;
  phantomEnabled: boolean;
  phantomLevel: number;
  phantomTemplateId: number | null;
  phantomBondPoints: number;
  phantomNodeSelections: Record<number, number>;
  phantomFactorSlots: Record<number, PhantomFactorSlotValue | null>;
  cookingBuff: CookingBuffState;
}

// ステータス1件分の「素の値からの変化」内訳。additive=平坦加算の合計、multiplier=%ボーナスの累積倍率、
// cookingBonus=料理バフ(料理・海風の宴)による最終加算(あれば)、levelBonus=冒険者レベル/潜在
// レベルによる加算(あれば。ステータス詳細では初期値/ステ変換値列側に表示するためadditiveとは分ける)。
export interface StatBreakdownEntry {
  base: number;
  additive: number;
  multiplier: number;
  cookingBonus?: number;
  levelBonus?: number;
}

export interface CalculateRawStatsResult {
  rawStats: Record<StatId, number>;
  // バトルイマジン + 潜在因子由来の最終ステータス%ボーナス(maxHp/atk/matk等)。
  // 装備・アビリティ等の平坦加算がすべて終わった後の値に対して乗算するため、
  // rawStats自体には含めず呼び出し側(useBuildState.stats算出)に返す。
  phantomFinalPct: Partial<Record<string, number>>;
  // R1アビリティ(type=4効果)によるメインステータス→攻撃力/物理防御力/ファスト等の
  // 変換率ボーナス(単位: 1ptあたりの実数値、例 0.125)。deriveStatsに渡して基礎変換率に加算する。
  conversionRateBonus: Partial<Record<StatId, number>>;
  // 進化ステータス(蒼海武器等)の会心/幸運/ファスト/器用さ"%"バリアントによる、最終結果への
  // 直接加算ボーナス(単位: 1/100。値600→+6%)。鼓舞/HP変動と同じく乗算ではなく加算のため、
  // phantomFinalPct(乗算用)とは別で持つ。単位はEquipmentSlotPicker等の表示(min/100)と同じ。
  finalPctAddend: Partial<Record<StatId, number>>;
  // ステータス詳細の「バフ効果」表示用: ステータスごとの素の値/加算/乗算の内訳。
  breakdown: Record<StatId, StatBreakdownEntry>;
  // アビリティ(例: フロストメイジ「二段増幅」)による、会心/ファスト/幸運/器用さ/万能のうち
  // その時点の最終値が最も高い1項目への最終%直接加算量(HP変動と同じ加算方式・単位=%
  // そのままの数値。finalPctAddendの1/100単位とは異なるので注意)。「最も高い1項目」の
  // 判定はHP変動/鼓舞等すべての最終調整が終わった後の値を見る必要があるため、rawStats
  // 自体には含めず呼び出し側(computeCookingAdjustments)に返す。
  highestStatFinalPctBonus: number;
  // アビリティ(例: ディバインアーチャー「迅射」)による攻撃速度への直接加算量(%そのままの数値)。
  // atkSpeedPercentはDerivedStats側の値(rawStats/StatIdに存在しない)のため、deriveStats()に
  // 直接渡す(finalPctAddendやphantomFinalPctの仕組みには乗らない)。
  atkSpeedFinalPctAddend: number;
  // アビリティ(例: ストームブレイド/ツインストライカー/ゲイルランサー「迅速」)による
  // 「ファスト%→攻撃速度%」変換率へのボーナス(単位: 1pt=1%、例 1.0)。deriveStats()に渡して
  // profession.atkSpeedPerHastePercentに加算する。
  atkSpeedPerHastePercentBonus: number;
  // モジュール効果(例: 「集中・詠唱」)による詠唱速度への直接加算量(%そのままの数値)。
  // castSpeedPercentはDerivedStats側の値(rawStats/StatIdに存在しない)のため、deriveStats()に
  // 直接渡す(atkSpeedFinalPctAddendと同じ扱い)。
  castSpeedFinalPctAddend: number;
  // アビリティ(ビートパフォーマー「幸運相乗」等、TALENT_LUCKY_HIT_DAMAGE_RATIO_BONUS参照)
  // による、幸運%1ptあたりの幸運の一撃ダメージ倍率への変換率ボーナス。deriveStats()側の
  // 基礎係数0.25に加算する。
  luckyHitDamageRatioBonus: number;
  // ファストの俊敏変換込み実数値(deriveStats側のhasteReal相当)。極性因子等によるファスト
  // 自身への%ボーナスを、俊敏変換分も含めた合算値に対して一度だけ適用した正確な値
  // (rawStats.hasteは従来通り俊敏変換分を含まないため、これと単純加算するとその分の
  // %ボーナスが抜け落ちる。上記hasteRealAdjustedのコメント参照)。deriveStats()に渡す。
  hasteRealAdjusted: number;
}

// 装備・精錬・アビリティ・装着効果・バトルイマジン・モジュール・冒険者レベル・
// 潜在因子・絆レベルの各効果を積算し、rawStats(実数値ステータス)を算出する。
// UIやReact stateには依存しない純粋関数。
export function calculateRawStats(input: CalculateRawStatsInput): CalculateRawStatsResult {
  const {
    equipped,
    legendaryAffixState,
    legendaryAffixGroupState,
    refineLevels,
    perfectlines,
    evolutionStats,
    profession,
    professionTypeKey,
    talentR1EnabledIds,
    talentR2EnabledIds,
    talentNodesById,
    r1NodeCount,
    battleImagines,
    imagineRanks,
    slotEnchants,
    moduleSlots,
    adventurerLevel,
    phantomEnabled,
    phantomLevel,
    phantomTemplateId,
    phantomBondPoints,
    phantomNodeSelections,
    phantomFactorSlots,
    cookingBuff,
  } = input;

  const total = { ...BASE_STATS };
  // ステータス詳細「バフ効果」表示用の内訳: 平坦加算の合計値 / %ボーナスの合計(単位: 1/10000)。
  // %ボーナスは複数ソース(バトルイマジン・潜在因子等)を全て合算してから、最後に一度だけ乗算する
  // (例: +10%と+15%の2つの効果は 1.1*1.15 ではなく 1.25 倍として扱う)。
  const additive: Partial<Record<StatId, number>> = {};
  const pctBonus: Partial<Record<StatId, number>> = {};
  const levelBonus: Partial<Record<StatId, number>> = {};
  const addStat = (statId: StatId, value: number) => {
    total[statId] += value;
    additive[statId] = (additive[statId] ?? 0) + value;
  };
  // 冒険者レベル/潜在レベルによる加算専用(ステータス詳細の初期値/ステ変換値列側に表示するため、
  // addStatのadditive(加算列)ではなくlevelBonus(初期値/ステ変換値列)に積む)。
  const addLevelStat = (statId: StatId, value: number) => {
    total[statId] += value;
    levelBonus[statId] = (levelBonus[statId] ?? 0) + value;
  };
  const addPctBonus = (statId: StatId, rawValue: number) => {
    pctBonus[statId] = (pctBonus[statId] ?? 0) + rawValue;
  };
  const talentSchoolId = getTalentSchoolId(profession, professionTypeKey);
  // 最終ステータス%ボーナス(潜在因子由来のphantomFinalPctと同じ後段適用先に合流させる)。
  // アビリティ(type=3効果、型依存のもの等)もここに追加する。
  const phantomFinalPct: Partial<Record<string, number>> = {};
  // R1アビリティ(type=4効果)によるメインステータス変換率ボーナス。deriveStatsに渡す。
  const conversionRateBonus: Partial<Record<StatId, number>> = {};
  // 進化ステータス(蒼海武器等)の会心/幸運/ファスト/器用さ"%"バリアントによる、最終結果への
  // 直接加算ボーナス(鼓舞/HP変動と同じ加算方式。乗算のphantomFinalPctとは別バケツで持つ)。
  const finalPctAddend: Partial<Record<StatId, number>> = {};
  // アビリティによる「5ステータスのうち最終値最大の1項目」への最終%加算量(例: 二段増幅)。
  let highestStatFinalPctBonus = 0;
  // アビリティによる攻撃速度への直接加算量(%、例: ディバインアーチャー「迅射」)。
  // atkSpeedPercentはDerivedStats側の値のためderiveStats()に渡す。
  let atkSpeedFinalPctAddend = 0;
  // アビリティによる「ファスト%→攻撃速度%」変換率へのボーナス(例: ストームブレイド/
  // ツインストライカー/ゲイルランサー「迅速」。profession.atkSpeedPerHastePercentに加算する)。
  let atkSpeedPerHastePercentBonus = 0;
  // モジュール効果による詠唱速度への直接加算量(%、例: 「集中・詠唱」)。castSpeedPercentは
  // DerivedStats側の値のためderiveStats()に直接渡す(atkSpeedFinalPctAddendと同じ扱い)。
  let castSpeedFinalPctAddend = 0;
  // 幸運%1ptあたりの幸運の一撃ダメージ倍率への変換率ボーナス(例: ビートパフォーマー
  // 「幸運相乗」)。deriveStats側の基礎係数0.25に加算する。
  let luckyHitDamageRatioBonus = 0;

  // 装備ステータス
  // 装備1つぶんの実数値(基礎/進化/改鋳)は、ここで四捨五入してから合算する(合算後に丸めるのでは
  // ない)。実測(滅妄強度、装備11部位を1つずつ残してゲーム内表示と比較)で、各装備の素の補間値を
  // Math.roundした後に合算した値が完全一致することを確認済み。%ボーナス系(finalPctAddend等)は
  // 対象外(実数値ではなく%空間の値のため丸めない)。
  const roundStat = (value: number) => Math.round(value);

  // 装備数が6部位以上の場合、最大HPに+2される現象を実測で確認(2026-08-06不具合報告)。
  // 発動条件・原因の詳細(装備数そのものか、他の量との偶然の相関か)は未特定だが、暫定対応として
  // 装備6部位以上で固定+2を加算する。原因が判明次第、正しい実装に置き換えること。
  if (Object.keys(equipped).length >= 6) {
    addStat('maxHp', 2);
  }
  for (const [slotId, equipmentItem] of Object.entries(equipped)) {
    const slotKey = slotId as EquipmentSlotId;
    const pLine = Math.min(
      perfectlines[slotKey] ?? getMaxPerfectline(equipmentItem),
      getMaxPerfectline(equipmentItem),
    );

    // 基礎ステータス
    for (const [attrId, min, max] of equipmentItem.baseStats) {
      const statId = EQUIP_ATTR_TO_STAT[attrId];
      if (statId !== undefined) {
        addStat(statId, roundStat(calcStatValue(min, max, pLine)));
      }
    }

    // 進化ステータス: 表示側(EquipmentSlotPicker/EquipmentItemPopup)と同じ分類
    // (classifyEvoDisplay)を共有し、計算と表示の食い違いを構造的に防ぐ。
    const { kind: evoKind, fixedEvoEffects } = classifyEvoDisplay(equipmentItem, talentSchoolId);
    const slotEvoStats = evolutionStats[slotKey] ?? [];

    const applyFixedEvoEffects = (effects: FixedEvoEffect[]) => {
      for (const [effectType, attrId, min, max, isPercent] of effects) {
        if (effectType === TALENT_EFFECT_TYPE_TYPE1_FINAL_PCT) {
          // effectType=3(BuffId参照): attrIdはEVO_ATTR_TO_STAT等のAttrId空間とは異なる
          // BuffId空間のため、TALENT側と同様に個別解釈が必要な効果のみ対応する。現状、単純な
          // ステータスボーナスとして表現できる確認済みの効果はない(蒼海の讃歌の「幸運効果の
          // ダメージ+15%」は対象を限定したダメージアップバフで幸運の一撃ダメージ倍率には
          // 影響しないと判明したため対象外。2026-08-09不具合報告)。
          continue;
        }
        const finalStatId = EVO_PCT_FINAL_ATTR_TO_STAT[attrId];
        if (finalStatId !== undefined) {
          // 会心/幸運/ファスト/器用さの"%"バリアント: 鼓舞/HP変動と同じく、収益逓減カーブ適用後の
          // 最終%表示値に直接加算する(乗算ではない)。%空間の値のため丸めない。
          finalPctAddend[finalStatId] =
            (finalPctAddend[finalStatId] ?? 0) + calcStatValue(min, max, pLine);
          continue;
        }
        const statId = isPercent ? EVO_PCT_ATTR_TO_STAT[attrId] : EVO_ATTR_TO_STAT[attrId];
        if (statId !== undefined) addStat(statId, roundStat(calcStatValue(min, max, pLine)));
      }
    };

    if (fixedEvoEffects) {
      // seriesFixed / btFixed: クラス型別の固定 Evo を適用
      applyFixedEvoEffects(fixedEvoEffects);
    } else if (evoKind === 'dataEvo') {
      // Evo1/Evo2 が異なる attrId の装備: attrId から直接ステータスを決定
      for (let i = 0; i <= 1; i++) {
        const evo = equipmentItem.evo[i];
        if (!evo) continue;
        const [attrId, evoMin, evoMax] = evo;
        const statId = EVO_ATTR_TO_STAT[attrId];
        if (statId !== undefined) addStat(statId, roundStat(calcStatValue(evoMin, evoMax, pLine)));
      }
    } else {
      // sameEvo / selectable: ユーザー選択を使用
      for (let i = 0; i <= 1; i++) {
        const statId = slotEvoStats[i];
        const evo = equipmentItem.evo[i];
        if (statId && evo) {
          const [, evoMin, evoMax] = evo;
          addStat(statId, roundStat(calcStatValue(evoMin, evoMax, pLine)));
        }
      }
    }
    // 改鋳スロット(seriesFixed 以外は常にユーザー選択)
    if (evoKind !== 'seriesFixed') {
      const reforgedStatId = slotEvoStats[2];
      if (reforgedStatId && equipmentItem.reforgeEvoMax > 0) {
        addStat(
          reforgedStatId,
          roundStat(calcStatValue(equipmentItem.reforgeEvoMin, equipmentItem.reforgeEvoMax, pLine)),
        );
      }
    }

    // 蒼海武器等の4枠選択式レアステータス: fixedEvolutionStatsと同じAttrId体系のため、
    // 同じ経路(EVO_PCT_FINAL/EVO_PCT/EVO_ATTR)で加算する。筋力/知力/敏捷%(IMAGINE_PCT_BASE)は
    // 別経路、物理/魔法攻撃力%(AFFIX_STAT_EFFECTS)はapplyFinalStatModifiers側で処理するため
    // ここでは扱わない(未対応の関数効果系attrIdも同様に、ここでは黙って無視する)。
    const groupSelections = legendaryAffixGroupState[slotKey];
    const affixGroups = equipmentItem.legendaryAffixGroups?.[String(talentSchoolId)];
    if (groupSelections && affixGroups) {
      const selectedEffects: FixedEvoEffect[] = [];
      for (let i = 0; i < affixGroups.length; i++) {
        const sel = groupSelections[i];
        if (!sel) continue;
        const entry = affixGroups[i]?.find((a) => a.attrId === sel.attrId);
        if (!entry) continue;
        const pctBaseStatId = IMAGINE_PCT_BASE[sel.attrId];
        if (pctBaseStatId !== undefined) {
          addPctBonus(pctBaseStatId, sel.value);
          continue;
        }
        selectedEffects.push([
          entry.effectType,
          sel.attrId,
          sel.value,
          sel.value,
          entry.isPercent,
          0,
          0,
        ]);
      }
      if (selectedEffects.length > 0) applyFixedEvoEffects(selectedEffects);
    }
  }

  // 精錬ステータス (物攻・魔攻・防御力・耐久)。docs/STATUS_CALCULATION.md「精錬物攻・精錬魔攻」
  // 「精錬防御力」の通り、精錬攻撃力/精錬防御力はいずれも物理/魔法攻撃力・物理/魔法防御力とは
  // 別枠(精錬防御力は被ダメージ計算で防御力の軽減とは別に乗算される2段階目の軽減)のため、
  // physicalDef/magicalDef本体には加算しない(refinePhysAtk/refineMagAtk/refineDefのみに積む)。
  const profId = profession.professionId;
  const applyRefineEffects = (effects: [number, number][]) => {
    for (const [attrId, value] of effects) {
      if (attrId === REFINE_ATK_ATTR_ID) {
        addStat('refinePhysAtk', value);
      } else if (attrId === REFINE_MATK_ATTR_ID) {
        addStat('refineMagAtk', value);
      } else if (attrId === REFINE_DEF_ATTR_ID) {
        addStat('refineDef', value);
      } else if (attrId === REFINE_ENDURANCE_ATTR_ID) {
        addStat('endurance', value);
      }
    }
  };
  for (const [slotId, equipmentItem] of Object.entries(equipped)) {
    const slotKey = slotId as EquipmentSlotId;
    const level = refineLevels[slotKey] ?? 0;
    if (level <= 0) continue;
    const refineId = refineData.partRefineIds[String(equipmentItem.part)]?.[String(profId)];
    if (refineId == null) continue;
    const refineGroup = refineData.refineById[String(refineId)];
    if (!refineGroup?.cumulative) continue;
    const effects = refineGroup.cumulative[level - 1];
    if (effects) applyRefineEffects(effects);
    // 精錬レベル節目ボーナス (Lv5/10/15/20/25/30の各節目到達時、通常効果に加えてそれぞれ加算・到達済みの節目はすべて累積)
    for (const [msLevel, msEffects] of Object.entries(refineGroup.milestones ?? {})) {
      if (Number(msLevel) <= level) applyRefineEffects(msEffects);
    }
  }

  // アビリティ効果の適用。R1/R2で効果種別の解釈は同一のため単一の実装を共用する。
  const applyTalentNodeEffects = (nodeIds: Iterable<number>) => {
    for (const nodeId of nodeIds) {
      const treeNode = talentNodesById.get(nodeId);
      if (!treeNode) continue;
      const td = talentTree.nodes[String(treeNode.talentId)];
      if (!td) continue;
      for (const eff of td.effects) {
        if (eff[0] === TALENT_EFFECT_TYPE_FLAT_STAT) {
          // attrIdが会心/幸運等の"%final"系バリアント(IMAGINE_PCT_FINALと同じID、単位1/10000)の
          // 場合は最終%乗算ボーナスとして扱う(例: ヘヴィガーディアン「癒しの砂」attrId 11324→
          // 最大HP+10%)。それ以外は通常の平坦加算。
          const finalStatId = IMAGINE_PCT_FINAL[eff[1] as ImagineFinalStatId];
          if (finalStatId !== undefined) {
            // phantomFinalPctは生の値(単位1/10000)をそのまま積む(ipct()側で1回だけ除算するため)。
            phantomFinalPct[finalStatId] = (phantomFinalPct[finalStatId] ?? 0) + eff[2];
          } else if (eff[1] === TALENT_ATK_SPEED_FINAL_PCT_ATTR_ID) {
            atkSpeedFinalPctAddend += eff[2] / 100;
          } else {
            const statId = TALENT_ATTR_TO_STAT[eff[1]];
            if (statId !== undefined) addStat(statId, eff[2]);
          }
        } else if (eff[0] === TALENT_EFFECT_TYPE_TYPE1_FINAL_PCT) {
          // 型によって効果内容が変わるアビリティ(例: ビートパフォーマー「変奏」)。
          // 対応する型(type1)使用時のみ最終%ボーナスとして反映する。
          const bonus = TALENT_TYPE1_ONLY_FINAL_PCT[eff[1]];
          if (bonus && professionTypeKey === 'type1') {
            phantomFinalPct[bonus.stat] = (phantomFinalPct[bonus.stat] ?? 0) + bonus.value;
          }
          // 型に関わらず常時有効な「5ステータス中最終値最大の1項目」への最終%加算
          // (例: フロストメイジ「二段増幅」)。
          const highestOfBonus = TALENT_HIGHEST_OF_FINAL_PCT[eff[1]];
          if (highestOfBonus) highestStatFinalPctBonus += highestOfBonus;
          // 型に関わらず常時有効な、特定の1ステータスへの平坦加算(例: ビートパフォーマー「会心回復」)。
          const flatStatBonus = TALENT_FLAT_PCT_TO_STAT[eff[1]];
          if (flatStatBonus) addStat(flatStatBonus.stat, flatStatBonus.value);
          // 型に関わらず常時有効な、rawStats側の実数値ステータスへの平坦加算
          // (例: フロストメイジ「高速詠唱」ファスト+2500)。
          const rawFlatBonus = TALENT_RAW_FLAT_TO_STAT[eff[1]];
          if (rawFlatBonus) addStat(rawFlatBonus.stat, rawFlatBonus.value);
          // 型に関わらず常時有効な、特定1ステータスの最終%表示値への直接加算
          // (例: ストームブレイド「烈風」器用さ+6%)。
          const finalPctAddendBonus = TALENT_FINAL_PCT_ADDEND_TO_STAT[eff[1]];
          if (finalPctAddendBonus) {
            finalPctAddend[finalPctAddendBonus.stat] =
              (finalPctAddend[finalPctAddendBonus.stat] ?? 0) + finalPctAddendBonus.value;
          }
          // 型に関わらず常時有効な、基礎ステータスへの%乗算ボーナス(例: フロストメイジ
          // 「知力強化」知力+5%)。
          const basePctBonus = TALENT_BASE_PCT_TO_STAT[eff[1]];
          if (basePctBonus) addPctBonus(basePctBonus.stat, basePctBonus.value);
          // 型に関わらず常時有効な、幸運%1ptあたりの幸運の一撃ダメージ倍率への変換率ボーナス
          // (例: ビートパフォーマー「幸運相乗」)。
          const luckyHitDamageRatio = TALENT_LUCKY_HIT_DAMAGE_RATIO_BONUS[eff[1]];
          if (luckyHitDamageRatio) luckyHitDamageRatioBonus += luckyHitDamageRatio;
        } else if (eff[0] === TALENT_EFFECT_TYPE_CONVERSION_RATE) {
          // メインステータス→攻撃力/物理防御力/ファスト等への変換率ボーナス
          // (例: ゲイルランサー「筋力変換」)。eff = [4, 元ステータス種別(未使用), attrId, rateX10000]。
          if (eff[2] === TALENT_ATK_SPEED_FINAL_PCT_ATTR_ID) {
            // ファスト%→攻撃速度%の変換率自体へのボーナス(例: ストームブレイド/ツインストライカー/
            // ゲイルランサー「迅速」)。rawStats側のStatIdを持たないため個別集計する。
            atkSpeedPerHastePercentBonus += eff[3] / PERCENT_BASIS_POINTS;
          } else {
            const statId = TALENT_ATTR_TO_STAT[eff[2]];
            if (statId !== undefined) {
              conversionRateBonus[statId] =
                (conversionRateBonus[statId] ?? 0) + eff[3] / PERCENT_BASIS_POINTS;
            }
          }
        }
      }
    }
  };
  // R1アビリティは常時有効。R2アビリティはR1全取得時のみ有効。
  const r1Full = r1NodeCount > 0 && talentR1EnabledIds.size >= r1NodeCount;
  applyTalentNodeEffects(talentR1EnabledIds);
  if (r1Full) applyTalentNodeEffects(talentR2EnabledIds);

  // 装着効果(エンチャント): 平坦加算（装備が外れているスロットは対象外）
  for (const [slotId, enchantItemId] of Object.entries(slotEnchants)) {
    if (enchantItemId == null) continue;
    if (!equipped[slotId as EquipmentSlotId]) continue;
    const effects = enchantEffectsById.get(enchantItemId);
    if (!effects) continue;
    for (const [attrId, value] of effects) {
      if (attrId === 11502) {
        // 全属性攻撃力: 防御力を無視して加算される点はdocs/STATUS_CALCULATION.md 6章の通り
        // 精錬攻撃力と同種の追加攻撃力だが、精錬攻撃力とは別枠のためrefinePhysAtk/
        // refineMagAtkには積まず、allAttrAtkにのみ積む。
        addStat('allAttrAtk', value);
      } else if (attrId === MOD_ADAPTIVE_MAIN_STAT_ATTR_ID) {
        // 適応筋力/知力/敏捷(例: 「キラーカニクモの刻印」武器装着効果): モジュールの
        // MOD_EFFECT_TYPE_ADAPTIVEと同じattrIdだが、エンチャントにも同じ意味で出現する。
        addStat(profession.mainStat, value);
      } else {
        const statId = ENCHANT_ATTR_TO_STAT[attrId];
        if (statId !== undefined) addStat(statId, value);
      }
    }
  }

  // 伝説刻印(LegendaryAffix): 防具の刻印(maxHp/physicalDef/allAttrResist)は実数値加算、
  // 筋力/知力/敏捷は防具でも%扱いのため基礎ステータスへの%ボーナスとして加算する。
  // 物理/魔法攻撃力の刻印(武器/アクセサリ)は最終ステータス乗算のため applyFinalStatModifiers で処理する。
  for (const [slotId, selection] of Object.entries(legendaryAffixState)) {
    if (!selection || !equipped[slotId as EquipmentSlotId]) continue;
    const flatStatId = LEGENDARY_AFFIX_FLAT_STAT[selection.attrId];
    if (flatStatId !== undefined) {
      addStat(flatStatId, selection.value);
      continue;
    }
    // 攻撃速度/詠唱速度の最終%直接加算(武器等の伝説刻印、例: attrId 11722/11732)。
    // モジュール/アビリティ側と同じattrId・同じ単位(1/10000)のため、同じ/100変換を使う。
    if (selection.attrId === TALENT_ATK_SPEED_FINAL_PCT_ATTR_ID) {
      atkSpeedFinalPctAddend += selection.value / 100;
      continue;
    }
    if (selection.attrId === MOD_CAST_SPEED_FINAL_PCT_ATTR_ID) {
      castSpeedFinalPctAddend += selection.value / 100;
      continue;
    }
    const pctStatId = IMAGINE_PCT_BASE[selection.attrId];
    if (pctStatId !== undefined) addPctBonus(pctStatId, selection.value);
  }

  // モジュールエフェクト (EffectType=1: 通常のステータス加算 / EffectType=5: 適応ステータス・攻撃力)
  const modEffectLevels = calcModuleEffectLevels(moduleSlots, modulesData.effects);
  for (const { effectId, level } of modEffectLevels) {
    if (level === 0) continue;
    const lvData = modulesData.effects[String(effectId)]?.levels[level];
    if (!lvData) continue;
    for (const [effectType, attrId, value] of lvData[2]) {
      if (effectType === MOD_EFFECT_TYPE_STAT && attrId === 11502) {
        // 全属性攻撃力(enchant側と同じ扱い。精錬攻撃力とは別枠のためallAttrAtkにのみ積む)。
        addStat('allAttrAtk', value);
      } else if (effectType === MOD_EFFECT_TYPE_STAT && attrId === TALENT_ATK_SPEED_FINAL_PCT_ATTR_ID) {
        // 攻撃速度の%finalバリアント(「集中・攻撃速度」等)。単位はタレント側と同じ100=1%。
        atkSpeedFinalPctAddend += value / 100;
      } else if (effectType === MOD_EFFECT_TYPE_STAT && attrId === MOD_CAST_SPEED_FINAL_PCT_ATTR_ID) {
        // 詠唱速度の%finalバリアント(「集中・詠唱」等)。単位は攻撃速度側と同じ100=1%。
        castSpeedFinalPctAddend += value / 100;
      } else if (effectType === MOD_EFFECT_TYPE_STAT) {
        const statId = MOD_ATTR_TO_STAT[attrId];
        if (statId !== undefined) addStat(statId, value);
      } else if (
        effectType === MOD_EFFECT_TYPE_ADAPTIVE &&
        attrId === MOD_ADAPTIVE_MAIN_STAT_ATTR_ID
      ) {
        addStat(profession.mainStat, value);
      } else if (effectType === MOD_EFFECT_TYPE_ADAPTIVE && attrId === MOD_ADAPTIVE_ATK_ATTR_ID) {
        const statId: StatId = profession.attackType === 'physical' ? 'atk' : 'matk';
        addStat(statId, value);
      }
    }
  }

  // モジュールリンクエフェクト (全ホールのリンクスタック合計 → グローバルボーナス)
  const globalLinkTotal = calcGlobalLink(moduleSlots);
  if (globalLinkTotal > 0) {
    const linkRow = [...modulesData.linkEffects].reverse().find(([lt]) => lt <= globalLinkTotal);
    if (linkRow) {
      for (const [effectType, attrId, value] of linkRow[2]) {
        if (effectType !== MOD_EFFECT_TYPE_STAT) continue;
        const statId = MOD_ATTR_TO_STAT[attrId];
        if (statId !== undefined) addStat(statId, value);
      }
    }
  }

  // 冒険者レベルによるステータスボーナス
  const lvData = levelCumulativeData[Math.min(adventurerLevel, levelCumulativeData.length - 1)];
  if (lvData) {
    for (const [sid, val] of Object.entries(lvData.stats) as [StatId, number][]) {
      addLevelStat(sid, val);
    }
  }

  // 潜在レベルによるステータス加算（enabled に関わらず常時反映）
  if (phantomLevel > 0 && playerLevelSeasonData.levelUpAttr.length > 0) {
    for (const [attrId, perLevel] of playerLevelSeasonData.levelUpAttr) {
      const statId = PHANTOM_LEVEL_ATTR_TO_STAT[attrId];
      if (statId !== undefined) addLevelStat(statId, phantomLevel * perLevel);
    }
  }

  // バトルイマジン パッシブ: 基礎ステータスへの%ボーナス (rawStats に乗算)
  // 装備・アビリティ・モジュール・冒険者レベル・潜在レベルの平坦加算がすべて終わった後の
  // 基礎ステータス全体に対して掛けるため、この位置で適用する。
  for (let i = 0; i < battleImagines.length; i++) {
    const id = battleImagines[i];
    if (id == null) continue;
    const rank = imagineRanks[i] ?? 0;
    const ima = imagineDataById[String(id)];
    for (const eff of ima?.passiveEffects ?? []) {
      const pctStatId = IMAGINE_PCT_BASE[eff[0]];
      if (pctStatId != null) {
        const value = eff[rank + 1] ?? eff[1];
        addPctBonus(pctStatId, value);
        continue;
      }
      // 実数値レーティング(IMAGINE_FLAT_STAT)と"raw/100=%"の生値(IMAGINE_RAW_PERCENT_STAT)は
      // どちらもrawStatsへの単純加算(addStat)で計算できるため、同じ経路にまとめる。
      const addStatId = IMAGINE_FLAT_STAT[eff[0]] ?? IMAGINE_RAW_PERCENT_STAT[eff[0]];
      if (addStatId != null) {
        const value = eff[rank + 1] ?? eff[1];
        addStat(addStatId, value);
      }
    }
    // BuffId参照のパッシブ(IMAGINE_BUF_FLAT_STAT参照。無条件で常時有効な先頭パラメータのみ対応)。
    for (const eff of ima?.bufPassiveEffects ?? []) {
      const buffId = eff[0] as number;
      const bufFlat = IMAGINE_BUF_FLAT_STAT[buffId];
      if (bufFlat == null) continue;
      const rankParams = (eff[rank + 1] ?? eff[1]) as number[];
      const value = rankParams[bufFlat.paramIndex];
      if (value != null) addStat(bufFlat.stat, value);
    }
  }

  // 絆レベル「5ステータス中最大の1項目」判定用のベース値スナップショット。装備・アビリティ・
  // バトルイマジン・冒険者レベル・潜在レベル(常時反映分)までの値のみを使い、これから適用する
  // 潜在因子効果(極性因子の%ボーナス含む)・絆レベル効果自身による変動は含めない
  // (2026-09-02不具合報告: 判定基準に極性因子の%ボーナスが混ざると、心相投影のON/OFFで
  // 判定結果自体が変わってしまい、ファストの方が高いはずの状況で幸運に絆レベル効果が誤って
  // 付与されていた。ファストはこのスナップショット時点では俊敏からの変換分〈hasteReal相当〉が
  // 未加算のため、その分だけ個別に加算して補正する)。
  const highestOfBaseStats: Record<StatId, number> = { ...total };
  highestOfBaseStats.haste += convertBySeparatelyTruncatedRates(
    total.agility,
    COMMON_STAT_COEFFICIENTS.hastePerAgilityPoint,
    conversionRateBonus.haste ?? 0,
  );

  // 潜在因子効果 (enabled 時のみ)。ツリー(テンプレート)自体が未開放の場合はphantomEnabledが
  // 自動的にfalseになる(store側、setPhantomTemplateId/setPhantomLevel)ため、ここでは
  // テンプレート自体の開放Lvは見ずノード個別の開放Lvのみ判定すればよい。
  if (phantomEnabled && phantomTemplateId != null) {
    const tmpl = seasonTalentData.templates[String(phantomTemplateId)];
    if (tmpl) {
      const activeIds = getActivePhantomNodeIds(
        tmpl.rootNodeId,
        phantomTemplateId,
        phantomNodeSelections,
      );
      for (const nodeId of activeIds) {
        const node = seasonTalentData.treeNodes[String(nodeId)];
        if (!node) continue;
        // ノード個別の開放Lv(潜在Lv)未満の場合、固定ノード効果・因子効果ともに反映しない
        // (ツリーの選択自体は許可されるが、潜在Lvが足りない間は効果を発揮しない)。
        if (phantomLevel < getUnlockLevel(node.unlockCondition)) continue;
        if (node.nodeType === 1) {
          // 固定ノード(ordinaryEffect): 大半はスキル固有/条件付き効果のため対象外。
          // ORDINARY_EFFECT_BONUS に対応付けがある単純なステータスボーナスのみ反映する。
          const oe = seasonTalentData.ordinaryEffects[String(nodeId)];
          if (!oe) continue;
          for (const eff of oe.effects) {
            if (eff[0] !== 3) continue;
            const bonus = ORDINARY_EFFECT_BONUS[eff[1]];
            if (!bonus) continue;
            if (bonus.kind === 'flat') {
              addStat(bonus.stat, bonus.value);
            } else {
              phantomFinalPct[bonus.stat] = (phantomFinalPct[bonus.stat] ?? 0) + bonus.value;
            }
          }
          continue;
        }
        if (node.nodeType !== 2) continue;
        const slot = phantomFactorSlots[node.groupId];
        if (!slot) continue;
        const factorClass = phantomFactorData.byClass[slot.classKey];
        if (!factorClass) continue;
        // 過去シーズンの因子(seasonId < 現行シーズン)はゲーム内で無効化されている
        // (ゲーム内説明文で明記)。旧セーブデータ互換でスロットの選択自体は残るが、
        // 効果は加算しない(表示側のisFactorClassLegacyと同じ判定基準)。
        if (factorClass.seasonId < CURRENT_FACTOR_SEASON_ID) continue;
        // クラス攻撃/クラス防御等のクラス限定因子は、現在のクラスと一致する場合のみ加算
        if (
          factorClass.professionIds.length > 0 &&
          !factorClass.professionIds.includes(profession.professionId)
        )
          continue;
        const gradeData = factorClass.grades[slot.grade - 1];
        if (!gradeData) continue;
        for (const [effectType, attrId, value] of gradeData.effects) {
          if (effectType !== PHANTOM_EFFECT_TYPE_STAT) continue;
          // 末尾4のAttrId(11014/11024/11034/11044/11324/11354)は%乗算値（単位:1/10000）
          const baseStatId = IMAGINE_PCT_BASE[attrId];
          if (baseStatId !== undefined) {
            addPctBonus(baseStatId, value);
            continue;
          }
          const finalStatKey = IMAGINE_PCT_FINAL[attrId as ImagineFinalStatId];
          if (finalStatKey !== undefined) {
            phantomFinalPct[finalStatKey] = (phantomFinalPct[finalStatKey] ?? 0) + value;
            continue;
          }
          const statId = PHANTOM_ATTR_TO_STAT[attrId];
          if (statId !== undefined) addStat(statId, value);
        }
        // effectType=3 極性バフ: 第2パスで適用するために収集
        for (let i = 0; i < gradeData.effects.length; i++) {
          const [effectType, buffId] = gradeData.effects[i];
          if (effectType !== PHANTOM_EFFECT_TYPE_POLARITY) continue;
          const polarity = FACTOR_POLARITY_EFFECTS[buffId];
          if (!polarity) continue;
          const pars = gradeData.buffPars?.[i] ?? [];
          const boostPct = pars[polarity.boostIdx] ?? 0;
          const penaltyPct = pars[polarity.penaltyIdx] ?? 0;
          addPctBonus(polarity.boostStat, boostPct);
          addPctBonus(polarity.penaltyStat, -penaltyPct);
        }
      }
    }
  }

  // 絆レベル効果 (enabled 時のみ)
  // 「最も高い1項目に加算」は highestOfBaseStats (潜在因子効果・絆レベル効果自身より前の
  // スナップショット、上記コメント参照) を参照して決定する。
  if (phantomEnabled && phantomTemplateId != null) {
    const tmpl = seasonTalentData.templates[String(phantomTemplateId)];
    if (tmpl) {
      const activeAdvEffects = Object.values(seasonTalentData.advancedEffects).filter(
        (ae) => ae.effectId === tmpl.advancedEffectId && phantomBondPoints >= ae.unlockFraction,
      );
      for (const ae of activeAdvEffects) {
        for (const [effectType, buffId] of ae.effects) {
          if (effectType !== PHANTOM_EFFECT_TYPE_POLARITY) continue;
          const statEffects = BOND_BUFF_STAT_EFFECTS[buffId];
          if (!statEffects) continue;
          for (const eff of statEffects) {
            if (eff.type === 'static') {
              addStat(eff.stat, eff.value);
            } else if (eff.type === 'highest_of') {
              // highestOfBaseStats(潜在因子効果より前のスナップショット)から最大値の stat に
              // 加算する。totalそのものを比較に使うと、潜在因子の極性バフ(%ボーナス)や絆レベル
              // 効果自身の加算(同種の他レベル分)が判定に混ざってしまい、心相投影のON/OFFで
              // 判定結果自体が変わってしまう(2026-09-02不具合報告: ファストの方が高いはずの
              // 状況で、極性因子の%ボーナスが幸運側に乗ることで幸運に誤って絆レベル効果が
              // 付与されていた)。
              let maxStat = eff.stats[0];
              for (const s of eff.stats.slice(1)) {
                if (highestOfBaseStats[s] > highestOfBaseStats[maxStat]) maxStat = s;
              }
              addStat(maxStat, eff.value);
            } else if (eff.type === 'final_pct') {
              finalPctAddend[eff.stat] = (finalPctAddend[eff.stat] ?? 0) + eff.value;
            } else if (eff.type === 'main_stat') {
              addStat(profession.mainStat, eff.value);
            } else if (eff.type === 'ratio_of') {
              addStat(eff.targetStat, total[eff.sourceStat] * eff.ratio);
            }
          }
        }
      }
    }
  }

  // スターオイル: 物理/魔法ダメージ強化度(クラスの攻撃タイプに応じてphysicalEnhance/magicalEnhanceへ加算)
  if (cookingBuff.starOilEnabled && cookingBuff.starOilValue !== 0) {
    const statId: StatId =
      profession.attackType === 'physical' ? 'physicalEnhance' : 'magicalEnhance';
    addStat(statId, cookingBuff.starOilValue);
  }

  // シロップ/脊椎試薬: 選択中の属性の属性強度へ加算する(属性ボーナス%算出に使用)。
  if (cookingBuff.syrupEnabled && cookingBuff.syrupElementStrength !== 0) {
    addStat(ELEMENT_ATTR_STR_STAT[cookingBuff.syrupElement], cookingBuff.syrupElementStrength);
  }

  // イベントバフ: クラスのメインステータス(筋力/知力/俊敏)への平坦加算。他のメインステータス
  // 加算源(装備・アビリティ等)と同様に%ボーナス適用前に加算し、メインステータスへの%ボーナスの
  // 対象にする(元は「海風の宴」専用の固定+500だったが、効果値を入力可能にして汎用化した)。
  if (cookingBuff.eventBuffEnabled && cookingBuff.eventBuffValue !== 0) {
    addStat(profession.mainStat, cookingBuff.eventBuffValue);
  }

  // 鼓舞(Inspiration、森癒/Lifebind・威咲/Smite): 選択中の効果に応じて筋力/知力/俊敏/耐久全てと
  // 物理防御力へ平坦加算する(%ボーナス適用前)。会心/幸運/ファスト/器用さ/万能への追加分は
  // 最終計算結果への直接加算のため、deriveStats後の最終値に対して加算する(useBuildState側で処理)。
  if (cookingBuff.inspirationEnabled) {
    const { mainStat, physDef } = INSPIRATION_VALUES[cookingBuff.inspirationVariant];
    addStat('strength', mainStat);
    addStat('intellect', mainStat);
    addStat('agility', mainStat);
    addStat('endurance', mainStat);
    addStat('physicalDef', physDef);
  }

  // 幸運会心(モジュールパワーコア効果): 会心ダメージ/幸運ダメージへの加算。
  // 「自分」はモジュールパネルで該当モジュールのパワーコア効果Lv5以上を発動している場合のみ有効。
  if (cookingBuff.luckyCritEnabled) {
    const ownLuckyCritLevel = getPowerCoreLevel(moduleSlots, POWER_CORE_EFFECT_IDS.luckyCrit);
    const { critDamage, luckyDamage } = calcLuckyCritBonus(cookingBuff, ownLuckyCritLevel);
    if (critDamage !== 0) addStat('critDamageBonus', critDamage);
    if (luckyDamage !== 0) addStat('luckyHitDamageBonus', luckyDamage);
  }

  // ステータス補正(仮): 加算用/乗算用%は他の加算・%ボーナス源と同じ扱い(乗算は合算後に
  // 一度だけ適用)。最終値補正(finalValue)はcomputeCookingAdjustments側で最終表示値に
  // 直接加算するため、ここでは扱わない。
  if (cookingBuff.statCorrectionEnabled) {
    for (const [statId, entry] of Object.entries(cookingBuff.statCorrections) as [
      StatId,
      { add: number; multPercent: number; finalValue: number },
    ][]) {
      if (entry.add !== 0) addStat(statId, entry.add);
      if (entry.multPercent !== 0) addPctBonus(statId, entry.multPercent * 100);
    }
  }

  // %ボーナスの適用: 同一ステータスに対する複数の%ボーナスは合算してから一度だけ乗算する
  // (例: +10%と+15%は 1.1*1.15 ではなく 1.25 倍として扱う)。
  // 浮動小数点誤差(15%のつもりが14.999...%になる等)を避けるため、乗算結果は一旦
  // roundCleanで丸め、最終的なステータス計算結果をtruncate2、PCT_BONUS_ROUNDED_STAT_IDSに
  // 該当する場合はroundToInt(四捨五入)、それ以外のINTEGER_TRUNCATED_STAT_IDSはtruncateInt
  // (切り捨て)で丸める(両ヘルパーのコメント参照)。
  // hasteのみ、この時点ではまだ俊敏由来の変換分(hasteReal相当)を合算していないため、
  // このループでは一旦スキップする(下記hasteRealAdjustedの計算を参照)。
  for (const [statId, rawValue] of Object.entries(pctBonus) as [StatId, number][]) {
    if (rawValue === 0 || statId === 'haste') continue;
    const factor = roundClean(1 + rawValue / PERCENT_BASIS_POINTS);
    const truncate = PCT_BONUS_ROUNDED_STAT_IDS.has(statId)
      ? roundToInt
      : INTEGER_TRUNCATED_STAT_IDS.has(statId)
        ? truncateInt
        : truncate2;
    total[statId] = truncate(roundClean(total[statId] * factor));
  }

  // 能力共鳴(Stat Resonance、響奏バフ): 平均値×倍率(%)÷100を、クラスのメインステータスへ
  // %ボーナス適用後に加算する(他のメインステータス加算源と異なり、%ボーナスの対象に含めない)。
  const statResonanceBonus = calcStatResonanceBonus(cookingBuff);
  if (statResonanceBonus !== 0) {
    total[profession.mainStat] += statResonanceBonus;
  }

  // ファストの俊敏変換込み実数値(hasteReal相当)を、極性因子等によるファスト自身への%ボーナスも
  // 反映した状態で計算する。deriveStats側の従来実装は「%ボーナス適用済みのraw.haste」+
  // 「%ボーナス未適用の俊敏変換分」を単純加算していたため、俊敏変換分だけ%ボーナスが
  // 素通りしてしまっていた(2026-09-02不具合報告: 極性因子「幸運+7.83%/ファスト-4.70%」適用時、
  // 実測ファスト29,760に対し29,778と算出。(28842+2000+386)*0.953を切り捨てた29,760が正しく、
  // 俊敏変換分386%ボーナス未適用分の差18がそのまま誤差になっていた)。ここでagility(俊敏)は
  // 上のstatResonanceBonus適用まで含めた最終値を使う(メインステータスが俊敏のクラスでも
  // 正しく反映されるように)。
  const hasteAgilityBonus = convertBySeparatelyTruncatedRates(
    total.agility,
    COMMON_STAT_COEFFICIENTS.hastePerAgilityPoint,
    conversionRateBonus.haste ?? 0,
  );
  const hasteRawValue = pctBonus.haste ?? 0;
  const hasteFactor = roundClean(1 + hasteRawValue / PERCENT_BASIS_POINTS);
  const hasteRealAdjusted = roundToInt(roundClean((total.haste + hasteAgilityBonus) * hasteFactor));
  // rawStats.haste自体は従来通り、俊敏変換分を含まない値として返す(表示側は
  // derivedStats.hasteReal/hasteRealAdjustedを参照する。CharacterPanel.tsx参照)。
  if (hasteRawValue !== 0) {
    total.haste = roundToInt(roundClean(total.haste * hasteFactor));
  }

  const breakdown = {} as Record<StatId, StatBreakdownEntry>;
  for (const statId of Object.keys(BASE_STATS) as StatId[]) {
    breakdown[statId] = {
      base: BASE_STATS[statId],
      additive: additive[statId] ?? 0,
      multiplier: 1 + (pctBonus[statId] ?? 0) / PERCENT_BASIS_POINTS,
      ...(statId === profession.mainStat && statResonanceBonus !== 0
        ? { cookingBonus: statResonanceBonus }
        : {}),
      ...(levelBonus[statId] ? { levelBonus: levelBonus[statId] } : {}),
    };
  }

  return {
    rawStats: total,
    phantomFinalPct,
    conversionRateBonus,
    finalPctAddend,
    breakdown,
    highestStatFinalPctBonus,
    atkSpeedFinalPctAddend,
    atkSpeedPerHastePercentBonus,
    castSpeedFinalPctAddend,
    luckyHitDamageRatioBonus,
    hasteRealAdjusted,
  };
}

export interface ApplyFinalStatModifiersResult {
  stats: Record<StatId, number>;
  // ステータス詳細「バフ効果」表示用: calculateRawStatsのbreakdownに、この関数で追加適用される
  // 最終ステータス%ボーナス(maxHp/atk/matk/physicalDef/haste/mastery/versatilityは乗算、
  // crit/luckおよびhaste/masteryへの追加加算分は最終%表示値への直接加算)を合算したもの。
  breakdown: Record<StatId, StatBreakdownEntry>;
}

// 刻印(伝説刻印) + バトルイマジン/潜在因子の最終ステータス%ボーナスを rawStats/derivedStats に適用し、
// CharacterPanel等に表示する最終 stats を算出する。
export function applyFinalStatModifiers(
  rawStats: Record<StatId, number>,
  breakdown: Record<StatId, StatBreakdownEntry>,
  derived: DerivedStats,
  legendaryAffixState: Partial<Record<EquipmentSlotId, LegendaryAffixSelection | undefined>>,
  battleImagines: (number | null)[],
  imagineRanks: number[],
  phantomFinalPct: Partial<Record<string, number>>,
  // 進化ステータス(蒼海武器等)の会心/幸運/ファスト/器用さ"%"バリアントによる、最終結果への
  // 直接加算ボーナス(鼓舞/HP変動と同じ加算方式。単位: 1/100)。
  finalPctAddend: Partial<Record<StatId, number>> = {},
  // 蒼海武器等の4枠選択式レアステータス選択(スロットごとに枠数分)。
  legendaryAffixGroupState: SlotLegendaryAffixGroups = {},
): ApplyFinalStatModifiersResult {
  // 伝説刻印(武器/アクセサリの物理/魔法攻撃力%): 複数刻印は加算してから一度だけ乗算する。
  let atkPctBonus = 0;
  let matkPctBonus = 0;
  for (const selection of Object.values(legendaryAffixState)) {
    if (!selection) continue;
    const eff = AFFIX_STAT_EFFECTS[selection.attrId];
    if (!eff) continue;
    if (eff.statId === 'atk') atkPctBonus += selection.value;
    if (eff.statId === 'matk') matkPctBonus += selection.value;
  }
  for (const selections of Object.values(legendaryAffixGroupState)) {
    for (const selection of selections ?? []) {
      if (!selection) continue;
      const eff = AFFIX_STAT_EFFECTS[selection.attrId];
      if (!eff) continue;
      if (eff.statId === 'atk') atkPctBonus += selection.value;
      if (eff.statId === 'matk') matkPctBonus += selection.value;
    }
  }
  const atkMult = roundClean(1 + atkPctBonus / PERCENT_BASIS_POINTS);
  const matkMult = roundClean(1 + matkPctBonus / PERCENT_BASIS_POINTS);
  // バトルイマジン パッシブ + 潜在因子: 最終ステータスへの%ボーナス
  const imagFinalPct: Partial<Record<string, number>> = { ...phantomFinalPct };
  for (let i = 0; i < battleImagines.length; i++) {
    const id = battleImagines[i];
    if (id == null) continue;
    const rank = imagineRanks[i] ?? 0;
    const ima = imagineDataById[String(id)];
    if (!ima?.passiveEffects) continue;
    for (const eff of ima.passiveEffects) {
      const key = IMAGINE_PCT_FINAL[eff[0] as ImagineFinalStatId];
      if (key != null) {
        const value = eff[rank + 1] ?? eff[1];
        imagFinalPct[key] = (imagFinalPct[key] ?? 0) + value;
      }
    }
  }
  const ipct = (key: string) => roundClean(1 + (imagFinalPct[key] ?? 0) / PERCENT_BASIS_POINTS);

  const stats: Record<StatId, number> = {
    ...rawStats,
    // maxHpのみ切り捨てではなく四捨五入(2026-08-06不具合報告: build1相当のケースで実測と
    // 四捨五入が一致したため。他のステータス(atk/matk/physicalDef等)は従来通り切り捨て)。
    maxHp: Math.round(roundClean(derived.maxHp * ipct('maxHp'))),
    atk: truncateInt(roundClean(derived.physicalAtk * atkMult * ipct('atk'))),
    matk: truncateInt(roundClean(derived.magicalAtk * matkMult * ipct('matk'))),
    physicalDef: truncate2(roundClean(derived.physicalDef * ipct('physicalDef'))),
    magicalDef: derived.magicalDef,
    crit: derived.critPercent + (finalPctAddend.crit ?? 0) / 100,
    haste: derived.hastePercent * ipct('haste') + (finalPctAddend.haste ?? 0) / 100,
    luck: derived.luckPercent + (finalPctAddend.luck ?? 0) / 100,
    mastery: derived.masteryPercent * ipct('mastery') + (finalPctAddend.mastery ?? 0) / 100,
    versatility: derived.versatilityPercent * ipct('versatility') + (finalPctAddend.versatility ?? 0) / 100,
    resist: derived.resistPercent,
  };

  // バフ効果の内訳に、この関数で適用した最終ステータス%ボーナスを合算する
  // (calculateRawStatsのbreakdownは、この段階のボーナスを一切含んでいないため)。
  const finalMultipliers: Partial<Record<StatId, number>> = {
    maxHp: ipct('maxHp'),
    atk: roundClean(atkMult * ipct('atk')),
    matk: roundClean(matkMult * ipct('matk')),
    physicalDef: ipct('physicalDef'),
    haste: ipct('haste'),
    mastery: ipct('mastery'),
    versatility: ipct('versatility'),
  };
  const mergedBreakdown = {} as Record<StatId, StatBreakdownEntry>;
  for (const statId of Object.keys(breakdown) as StatId[]) {
    const entry = breakdown[statId];
    const finalMult = finalMultipliers[statId];
    const addend = finalPctAddend[statId];
    let merged = entry;
    if (finalMult !== undefined) {
      merged = { ...merged, multiplier: roundClean(merged.multiplier * finalMult) };
    }
    if (addend) {
      merged = { ...merged, cookingBonus: (merged.cookingBonus ?? 0) + addend / 100 };
    }
    mergedBreakdown[statId] = merged;
  }

  return { stats, breakdown: mergedBreakdown };
}
