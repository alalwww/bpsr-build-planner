import type { Profession } from '../profession';
import type { CookingBuffState, StatCorrectionEntry, StatId } from '../types';

// イベントバフのメインステータス加算量の既定値(旧・海風の宴の固定効果量を踏襲)。
export const DEFAULT_EVENT_BUFF_VALUE = 500;

export const DEFAULT_COOKING_BUFF: CookingBuffState = {
  cookingEnabled: false,
  cookingAtkValue: 210,
  cookingEliteDamagePercent: 10,
  syrupEnabled: false,
  syrupElement: 'fire',
  syrupElementStrength: 1500,
  starOilEnabled: false,
  starOilValue: 1000,
  eventBuffEnabled: false,
  eventBuffValue: DEFAULT_EVENT_BUFF_VALUE,
  inspirationEnabled: false,
  inspirationVariant: 'lifebind',
  statResonanceEnabled: false,
  statResonanceBaseValue: 7000,
  statResonanceMultiplierPercent: 24,
  luckyCritEnabled: false,
  luckyCritVariant: 'self',
  lifeWaveEnabled: false,
  dmgStackEnabled: false,
  dmgStackCount: 4,
  agileEnabled: false,
  statCorrectionEnabled: false,
  statCorrections: {},
};

// モジュールのパワーコア効果(Lv5/6)のうち、バフ計算対象となるeffectId。
export const POWER_CORE_EFFECT_IDS = {
  luckyCrit: 2406, // 極・幸運会心(Team Luck & Crit)
  lifeWave: 2404, // 極・HP変動(Life Wave)
  dmgStack: 2104, // 極・ダメージ増強(DMG Stack)
  agile: 2105, // 極・適応力(Agile)
} as const;

// 幸運会心: 会心ダメージ/幸運ダメージへの加算量(Lv5/6。単位はcritDamageBonus/luckyHitDamageBonus
// と同じ、%*100)。自分が発動した場合はこの値の2倍を加算する。
export const LUCKY_CRIT_VALUES: Record<5 | 6, { critDamage: number; luckyDamage: number }> = {
  5: { critDamage: 310, luckyDamage: 200 },
  6: { critDamage: 520, luckyDamage: 340 },
};

// 極・HP変動: 会心/幸運/ファスト/器用さ/万能のうち計算結果が最も高い項目への加算量(%、Lv5/6)。
export const LIFE_WAVE_VALUES: Record<5 | 6, number> = { 5: 6, 6: 10 };

// 極・ダメージ増強: 1スタックあたりのダメージ増加%(Lv5/6)。現時点では表示のみでステ計算には含めない。
export const DMG_STACK_PER_STACK: Record<5 | 6, number> = { 5: 1.65, 6: 2.75 };

// 極・適応力: 移動速度%(表示のみ、未計算)/物理・魔法攻撃力への乗算バフ%(Lv5/6)。
export const AGILE_VALUES: Record<5 | 6, { moveSpeed: number; atkMultPercent: number }> = {
  5: { moveSpeed: 18, atkMultPercent: 6 },
  6: { moveSpeed: 30, atkMultPercent: 10 },
};

// 幸運会心の選択中バリアントに応じた、会心ダメージ/幸運ダメージへの加算量を算出する。
// 「自分」は自身のパワーコア到達Lv(5/6)の値を2倍、「被Lv5/6」は固定Lvの値をそのまま返す。
export function calcLuckyCritBonus(
  cookingBuff: CookingBuffState,
  ownLevel: 0 | 5 | 6,
): { critDamage: number; luckyDamage: number } {
  if (!cookingBuff.luckyCritEnabled) return { critDamage: 0, luckyDamage: 0 };
  if (cookingBuff.luckyCritVariant === 'receivedLv5') return LUCKY_CRIT_VALUES[5];
  if (cookingBuff.luckyCritVariant === 'receivedLv6') return LUCKY_CRIT_VALUES[6];
  // 'self': 自身のパワーコアがLv5/6未達成の場合は無効
  if (ownLevel === 0) return { critDamage: 0, luckyDamage: 0 };
  const base = LUCKY_CRIT_VALUES[ownLevel];
  return { critDamage: base.critDamage * 2, luckyDamage: base.luckyDamage * 2 };
}

// 鼓舞(森癒・威咲)による加算量。ヴァーダントオラクルのアビリティツリー由来
// (talentId 502「鼓舞」R1 base: 筋力/知力/俊敏/耐久+135pt・会心/幸運/ファスト/器用さ/万能+1.5%、
// talentId 529「防御強化」R1: 物理防御力+400pt、talentId 568「鼓舞強化」森癒R2: 上記4ステータスに
// さらに+135pt、talentId 557「鼓舞の極意」森癒R2: 鼓舞の効果を全て(物理防御力含む)2倍にする、
// と実機で確認)。威咲はR1のみ(森癒限定のR2強化を受けられない)ため据え置き、森癒はR2強化込みで
// (135+135)×2 = 270×2 = 540pt / 1.5%×2 = 3% / 物理防御力は400×2 = 800ptとなる。
// mainStat=筋力/知力/俊敏/耐久全てへの平坦加算、percent=会心/幸運/ファスト/器用さ/万能の
// 最終計算結果への直接加算(%)、physDef=物理防御力への平坦加算。
export const INSPIRATION_VALUES: Record<
  CookingBuffState['inspirationVariant'],
  { mainStat: number; percent: number; physDef: number }
> = {
  lifebind: { mainStat: 540, percent: 3, physDef: 800 },
  smite: { mainStat: 135, percent: 1.5, physDef: 400 },
};

// 鼓舞のpercent効果(最終計算結果への直接加算)の対象ステータス。
export const INSPIRATION_PERCENT_STAT_IDS: StatId[] = [
  'crit',
  'haste',
  'luck',
  'mastery',
  'versatility',
];

// 能力共鳴(響奏バフ)の平均倍率(%)の選択肢。
export const STAT_RESONANCE_MULTIPLIER_OPTIONS = [8, 12, 16, 24, 32] as const;

// 精鋭ダメージ(料理)の選択肢。反映先のステータスが現状存在しないため、選択できるだけで
// 計算には使わない(将来対応するAttrId/StatIdが判明したら計算に組み込む)。
export const ELITE_DAMAGE_OPTIONS = [0, 5, 10] as const;

// 能力共鳴(Stat Resonance、響奏バフ): 基準値×倍率(%)÷100を算出する。
export function calcStatResonanceBonus(cookingBuff: CookingBuffState): number {
  if (!cookingBuff.statResonanceEnabled || cookingBuff.statResonanceBaseValue === 0) return 0;
  return (cookingBuff.statResonanceBaseValue * cookingBuff.statResonanceMultiplierPercent) / 100;
}

export interface CookingBuffResult {
  // 料理バフ表示用: 最終atk/matkへの料理攻撃力加算量(料理、0=なし)。
  atkBonus: number;
}

// 料理(cookingAtkValue)による最終atk/matkへの加算量を算出する。装備・アビリティ等の
// 加算・乗算計算がすべて終わった後の値に対して加算するため、呼び出し側でrawStats/deriveStats
// 算出後の最終値に対してこの結果を加算する。
export function applyCookingBuff(cookingBuff: CookingBuffState): CookingBuffResult {
  const atkBonus = cookingBuff.cookingEnabled ? cookingBuff.cookingAtkValue : 0;
  return { atkBonus };
}

// 最終ステータスへの料理バフ系(適応力・料理攻撃力・鼓舞・HP変動)の
// 調整を1件ずつ表す。multiplier: 対象statに乗算する係数。addend: 対象statに加算する値。
export interface CookingAdjustment {
  statId: StatId;
  multiplier?: number;
  addend?: number;
}

// 適応力(乗算)→料理攻撃力(加算)→鼓舞(複数statへの加算)→アビリティ(二段増幅、実数値が
// 最大のstat種別へ加算)→HP変動(その時点の最終%表示値が最大のstat種別へ加算)の順で、
// 最終ステータス(finalStats)に対する調整リストを算出する。二段増幅とHP変動は「最大stat」の
// 判定基準が異なる点に注意(2026-08-05不具合報告で判明): 二段増幅はゲーム内が収益逓減曲線
// 適用前の実数値(highestOfFiveRawStats、%変換前の装備等由来の実数値。ファストはagility変換
// 込みのhasteReal)で判定するのに対し、HP変動(パワーコア)はfinalStatsのスクラッチコピー
// (working、それ以前の調整が適用済みの最終%表示値)で判定する。呼び出し側はこのリストを
// 自身の出力形(実数値 / StatBreakdownEntryの multiplier・cookingBonus)に適用するだけでよい。
export function computeCookingAdjustments(
  finalStats: Record<StatId, number>,
  cookingAtkStatId: StatId,
  cookingAtkBonus: number,
  inspirationPercentBonus: number,
  highestStatFinalPctBonus: number,
  lifeWaveBonus: number,
  agileAtkMultPercent: number,
  // 二段増幅の「5ステータス中最大の1項目」判定用の実数値(%変換前。crit/luck/mastery/
  // versatilityはrawStatsそのまま、hasteはagility変換込みのderived.hasteRealを渡す)。
  highestOfFiveRawStats: Record<StatId, number>,
  // ステータス補正(仮)の最終値補正(finalValue)分。無効時は呼び出し側で{}を渡す。
  statCorrections: Partial<Record<StatId, StatCorrectionEntry>> = {},
): CookingAdjustment[] {
  const adjustments: CookingAdjustment[] = [];
  const working = { ...finalStats };

  if (agileAtkMultPercent !== 0) {
    const multiplier = 1 + agileAtkMultPercent / 100;
    working[cookingAtkStatId] *= multiplier;
    adjustments.push({ statId: cookingAtkStatId, multiplier });
  }
  if (cookingAtkBonus !== 0) {
    working[cookingAtkStatId] += cookingAtkBonus;
    adjustments.push({ statId: cookingAtkStatId, addend: cookingAtkBonus });
  }
  if (inspirationPercentBonus !== 0) {
    for (const statId of INSPIRATION_PERCENT_STAT_IDS) {
      working[statId] += inspirationPercentBonus;
      adjustments.push({ statId, addend: inspirationPercentBonus });
    }
  }
  const addToHighestOf = (bonus: number, basis: Record<StatId, number>) => {
    if (bonus === 0) return;
    let maxStatId = INSPIRATION_PERCENT_STAT_IDS[0];
    for (const statId of INSPIRATION_PERCENT_STAT_IDS.slice(1)) {
      if (basis[statId] > basis[maxStatId]) maxStatId = statId;
    }
    working[maxStatId] += bonus;
    adjustments.push({ statId: maxStatId, addend: bonus });
  };
  // 二段増幅: 実数値(収益逓減曲線適用前)基準。
  addToHighestOf(highestStatFinalPctBonus, highestOfFiveRawStats);
  // HP変動(パワーコア): その時点の最終%表示値基準。
  addToHighestOf(lifeWaveBonus, working);

  for (const [statId, entry] of Object.entries(statCorrections) as [
    StatId,
    StatCorrectionEntry,
  ][]) {
    if (entry.finalValue === 0) continue;
    working[statId] += entry.finalValue;
    adjustments.push({ statId, addend: entry.finalValue });
  }

  return adjustments;
}

// ステータス補正(仮)パネルの対象ステータス一覧(クラスのメイン攻撃力に応じて解決。
// 筋力/知力/俊敏はクラスのメインステータスに関わらず常に全て表示する)。
export interface StatCorrectionTarget {
  id: StatId;
  isPercent: boolean;
}

export function getStatCorrectionTargets(profession: Profession): StatCorrectionTarget[] {
  const atkStatId: StatId = profession.attackType === 'physical' ? 'atk' : 'matk';
  return [
    { id: 'maxHp', isPercent: false },
    { id: atkStatId, isPercent: false },
    { id: 'strength', isPercent: false },
    { id: 'intellect', isPercent: false },
    { id: 'agility', isPercent: false },
    { id: 'endurance', isPercent: false },
    { id: 'crit', isPercent: true },
    { id: 'haste', isPercent: true },
    { id: 'luck', isPercent: true },
    { id: 'mastery', isPercent: true },
    { id: 'versatility', isPercent: true },
    { id: 'resist', isPercent: true },
  ];
}
