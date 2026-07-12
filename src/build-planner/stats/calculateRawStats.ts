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
  SlotRefineLevels,
  StatId,
} from '../types';
import type { PhantomFactorSlotValue } from '../phantom/phantomData';
import {
  getActivePhantomNodeIds,
  pfData as phantomFactorData,
  stData as seasonTalentData,
} from '../phantom/phantomData';
import { BASE_STATS } from './baseStats';
import {
  calcLuckyCritBonus,
  calcStatResonanceBonus,
  INSPIRATION_VALUES,
  POWER_CORE_EFFECT_IDS,
  SEA_BREEZE_MAIN_STAT_BONUS,
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
  IMAGINE_FLAT_STAT,
  IMAGINE_PCT_BASE,
  IMAGINE_PCT_FINAL,
  type ImagineFinalStatId,
  LEGENDARY_AFFIX_FLAT_STAT,
  MOD_ADAPTIVE_ATK_ATTR_ID,
  MOD_ADAPTIVE_MAIN_STAT_ATTR_ID,
  MOD_ATTR_TO_STAT,
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
  TALENT_EFFECT_TYPE_CONVERSION_RATE,
  TALENT_EFFECT_TYPE_FLAT_STAT,
  TALENT_EFFECT_TYPE_TYPE1_FINAL_PCT,
  TALENT_FLAT_PCT_TO_STAT,
  TALENT_HIGHEST_OF_FINAL_PCT,
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
import type { DerivedStats } from './deriveStats';
import { calcGlobalLink } from '../module/moduleData';

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

export interface CalculateRawStatsInput {
  equipped: EquippedItems;
  legendaryAffixState: Partial<Record<EquipmentSlotId, LegendaryAffixSelection | undefined>>;
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
// cookingBonus=料理バフ(料理・海風の宴)による最終加算(あれば)。
export interface StatBreakdownEntry {
  base: number;
  additive: number;
  multiplier: number;
  cookingBonus?: number;
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
}

// 装備・精錬・アビリティ・装着効果・バトルイマジン・モジュール・冒険者レベル・
// 潜在因子・絆レベルの各効果を積算し、rawStats(実数値ステータス)を算出する。
// UIやReact stateには依存しない純粋関数。
export function calculateRawStats(input: CalculateRawStatsInput): CalculateRawStatsResult {
  const {
    equipped,
    legendaryAffixState,
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
  const addStat = (statId: StatId, value: number) => {
    total[statId] += value;
    additive[statId] = (additive[statId] ?? 0) + value;
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

  // 装備ステータス
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
        addStat(statId, calcStatValue(min, max, pLine));
      }
    }

    // 進化ステータス: 表示側(EquipmentSlotPicker/EquipmentItemPopup)と同じ分類
    // (classifyEvoDisplay)を共有し、計算と表示の食い違いを構造的に防ぐ。
    const { kind: evoKind, fixedEvoEffects } = classifyEvoDisplay(equipmentItem, talentSchoolId);
    const slotEvoStats = evolutionStats[slotKey] ?? [];

    const applyFixedEvoEffects = (effects: FixedEvoEffect[]) => {
      for (const [, attrId, min, max, isPercent] of effects) {
        const finalStatId = EVO_PCT_FINAL_ATTR_TO_STAT[attrId];
        if (finalStatId !== undefined) {
          // 会心/幸運/ファスト/器用さの"%"バリアント: 鼓舞/HP変動と同じく、収益逓減カーブ適用後の
          // 最終%表示値に直接加算する(乗算ではない)。
          finalPctAddend[finalStatId] =
            (finalPctAddend[finalStatId] ?? 0) + calcStatValue(min, max, pLine);
          continue;
        }
        const statId = isPercent ? EVO_PCT_ATTR_TO_STAT[attrId] : EVO_ATTR_TO_STAT[attrId];
        if (statId !== undefined) addStat(statId, calcStatValue(min, max, pLine));
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
        if (statId !== undefined) addStat(statId, calcStatValue(evoMin, evoMax, pLine));
      }
    } else {
      // sameEvo / selectable: ユーザー選択を使用
      for (let i = 0; i <= 1; i++) {
        const statId = slotEvoStats[i];
        const evo = equipmentItem.evo[i];
        if (statId && evo) {
          const [, evoMin, evoMax] = evo;
          addStat(statId, calcStatValue(evoMin, evoMax, pLine));
        }
      }
    }
    // 改鋳スロット(seriesFixed 以外は常にユーザー選択)
    if (evoKind !== 'seriesFixed') {
      const reforgedStatId = slotEvoStats[2];
      if (reforgedStatId && equipmentItem.reforgeEvoMax > 0) {
        addStat(
          reforgedStatId,
          calcStatValue(equipmentItem.reforgeEvoMin, equipmentItem.reforgeEvoMax, pLine),
        );
      }
    }
  }

  // 精錬ステータス (物攻・魔攻・防御力・耐久)。docs/STATUS_CALCULATION.md「精錬物攻・精錬魔攻」の通り、
  // 精錬攻撃力は物理/魔法攻撃力(防御力減衰の対象)とは別枠で、防御減衰の"後"に加算される値のため、
  // atk/matk本体には加算しない(refinePhysAtk/refineMagAtkのみに積む)。
  const profId = profession.professionId;
  const applyRefineEffects = (effects: [number, number][]) => {
    for (const [attrId, value] of effects) {
      if (attrId === REFINE_ATK_ATTR_ID) {
        addStat('refinePhysAtk', value);
      } else if (attrId === REFINE_MATK_ATTR_ID) {
        addStat('refineMagAtk', value);
      } else if (attrId === REFINE_DEF_ATTR_ID) {
        addStat('physicalDef', value);
        addStat('magicalDef', value);
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
        } else if (eff[0] === TALENT_EFFECT_TYPE_CONVERSION_RATE) {
          // メインステータス→攻撃力/物理防御力/ファスト等への変換率ボーナス
          // (例: ゲイルランサー「筋力変換」)。eff = [4, 元ステータス種別(未使用), attrId, rateX10000]。
          const statId = TALENT_ATTR_TO_STAT[eff[2]];
          if (statId !== undefined) {
            conversionRateBonus[statId] =
              (conversionRateBonus[statId] ?? 0) + eff[3] / PERCENT_BASIS_POINTS;
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
      addStat(sid, val);
    }
  }

  // 潜在レベルによるステータス加算（enabled に関わらず常時反映）
  if (phantomLevel > 0 && playerLevelSeasonData.levelUpAttr.length > 0) {
    for (const [attrId, perLevel] of playerLevelSeasonData.levelUpAttr) {
      const statId = PHANTOM_LEVEL_ATTR_TO_STAT[attrId];
      if (statId !== undefined) addStat(statId, phantomLevel * perLevel);
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
    if (!ima?.passiveEffects) continue;
    for (const eff of ima.passiveEffects) {
      const pctStatId = IMAGINE_PCT_BASE[eff[0]];
      if (pctStatId != null) {
        const value = eff[rank + 1] ?? eff[1];
        addPctBonus(pctStatId, value);
        continue;
      }
      const flatStatId = IMAGINE_FLAT_STAT[eff[0]];
      if (flatStatId != null) {
        const value = eff[rank + 1] ?? eff[1];
        addStat(flatStatId, value);
      }
    }
  }

  // 潜在因子効果 (enabled 時のみ)
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
  // 「最も高い1項目に加算」は因子効果反映後の total を参照して決定する
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
              // 現時点の total から最大値の stat に加算
              let maxStat = eff.stats[0];
              for (const s of eff.stats.slice(1)) {
                if (total[s] > total[maxStat]) maxStat = s;
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

  // 海風の宴: クラスのメインステータス(筋力/知力/俊敏)への平坦加算。他のメインステータス加算源
  // (装備・アビリティ等)と同様に%ボーナス適用前に加算し、メインステータスへの%ボーナスの対象にする。
  if (cookingBuff.seaBreezeEnabled) {
    addStat(profession.mainStat, SEA_BREEZE_MAIN_STAT_BONUS);
  }

  // 鼓舞(Inspiration、森癒/Lifebind・威咲/Smite): 選択中の効果に応じて筋力/知力/俊敏全てへ
  // 平坦加算する(%ボーナス適用前)。会心/幸運/ファスト/器用さ/万能への追加分は最終計算結果への
  // 直接加算のため、deriveStats後の最終値に対して加算する(useBuildState側で処理)。
  if (cookingBuff.inspirationEnabled) {
    const { mainStat } = INSPIRATION_VALUES[cookingBuff.inspirationVariant];
    addStat('strength', mainStat);
    addStat('intellect', mainStat);
    addStat('agility', mainStat);
  }

  // 幸運会心(モジュールパワーコア効果): 会心ダメージ/幸運ダメージへの加算。
  // 「自分」はモジュールパネルで該当モジュールのパワーコア効果Lv5以上を発動している場合のみ有効。
  if (cookingBuff.luckyCritEnabled) {
    const ownLuckyCritLevel = getPowerCoreLevel(moduleSlots, POWER_CORE_EFFECT_IDS.luckyCrit);
    const { critDamage, luckyDamage } = calcLuckyCritBonus(cookingBuff, ownLuckyCritLevel);
    if (critDamage !== 0) addStat('critDamageBonus', critDamage);
    if (luckyDamage !== 0) addStat('luckyHitDamageBonus', luckyDamage);
  }

  // %ボーナスの適用: 同一ステータスに対する複数の%ボーナスは合算してから一度だけ乗算する
  // (例: +10%と+15%は 1.1*1.15 ではなく 1.25 倍として扱う)。
  // 浮動小数点誤差(15%のつもりが14.999...%になる等)を避けるため、乗算結果は一旦
  // roundCleanで丸め、最終的なステータス計算結果のみtruncate2で切り捨てる。
  for (const [statId, rawValue] of Object.entries(pctBonus) as [StatId, number][]) {
    if (rawValue === 0) continue;
    const factor = roundClean(1 + rawValue / PERCENT_BASIS_POINTS);
    total[statId] = truncate2(roundClean(total[statId] * factor));
  }

  // 能力共鳴(Stat Resonance、響奏バフ): 平均値×倍率(%)÷100を、クラスのメインステータスへ
  // %ボーナス適用後に加算する(他のメインステータス加算源と異なり、%ボーナスの対象に含めない)。
  const statResonanceBonus = calcStatResonanceBonus(cookingBuff);
  if (statResonanceBonus !== 0) {
    total[profession.mainStat] += statResonanceBonus;
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
    maxHp: truncate2(roundClean(derived.maxHp * ipct('maxHp'))),
    atk: truncate2(roundClean(derived.physicalAtk * atkMult * ipct('atk'))),
    matk: truncate2(roundClean(derived.magicalAtk * matkMult * ipct('matk'))),
    physicalDef: truncate2(roundClean(derived.physicalDef * ipct('physicalDef'))),
    magicalDef: derived.magicalDef,
    crit: derived.critPercent + (finalPctAddend.crit ?? 0) / 100,
    haste: derived.hastePercent * ipct('haste') + (finalPctAddend.haste ?? 0) / 100,
    luck: derived.luckPercent + (finalPctAddend.luck ?? 0) / 100,
    mastery: derived.masteryPercent * ipct('mastery') + (finalPctAddend.mastery ?? 0) / 100,
    versatility: derived.versatilityPercent * ipct('versatility'),
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
