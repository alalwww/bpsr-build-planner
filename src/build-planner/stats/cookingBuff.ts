import type { CookingBuffState, StatId } from '../types';

export const DEFAULT_COOKING_BUFF: CookingBuffState = {
  cookingEnabled: false,
  cookingAtkValue: 0,
  cookingEliteDamagePercent: 0,
  syrupEnabled: false,
  syrupElement: 'fire',
  syrupElementStrength: 0,
  starOilEnabled: false,
  starOilValue: 0,
  seaBreezeEnabled: false,
  moraleBoostEnabled: false,
  moraleBoostVariant: 'forestHeal',
  resonanceEnabled: false,
  resonanceBaseValue: 6300,
  resonanceMultiplierPercent: 24,
  luckyCritEnabled: false,
  luckyCritVariant: 'self',
  hpShiftEnabled: false,
  damageBoostEnabled: false,
  damageBoostStacks: 4,
  adaptabilityEnabled: false,
};

// モジュールのパワーコア効果(Lv5/6)のうち、バフ計算対象となるeffectId。
export const POWER_CORE_EFFECT_IDS = {
  luckyCrit: 2406, // 幸運会心
  hpShift: 2404, // HP変動
  damageBoost: 2104, // ダメージ増強
  adaptability: 2105, // 適応力
} as const;

// 幸運会心: 会心ダメージ/幸運ダメージへの加算量(Lv5/6。単位はcritDamageBonus/luckyHitDamageBonus
// と同じ、%*100)。自分が発動した場合はこの値の2倍を加算する。
export const LUCKY_CRIT_VALUES: Record<5 | 6, { critDamage: number; luckyDamage: number }> = {
  5: { critDamage: 310, luckyDamage: 200 },
  6: { critDamage: 520, luckyDamage: 340 },
};

// HP変動: 会心/幸運/ファスト/器用さ/万能のうち計算結果が最も高い項目への加算量(%、Lv5/6)。
export const HP_SHIFT_VALUES: Record<5 | 6, number> = { 5: 6, 6: 10 };

// ダメージ増強: 1スタックあたりのダメージ増加%(Lv5/6)。現時点では表示のみでステ計算には含めない。
export const DAMAGE_BOOST_PER_STACK: Record<5 | 6, number> = { 5: 1.65, 6: 2.75 };

// 適応力: 移動速度%(表示のみ、未計算)/物理・魔法攻撃力への乗算バフ%(Lv5/6)。
export const ADAPTABILITY_VALUES: Record<5 | 6, { moveSpeed: number; atkMultPercent: number }> = {
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

// 海風の宴によるメインステータス(筋力/知力/俊敏)への加算量。他のメインステータス加算源と同様に
// %ボーナス適用前に加算するため、calculateRawStatsのaddStat内で直接この定数を使用する。
export const SEA_BREEZE_MAIN_STAT_BONUS = 500;

// 鼓舞(森癒/威咲)による加算量。mainStat=筋力/知力/俊敏全てへの平坦加算、
// percent=会心/幸運/ファスト/器用さ/万能の最終計算結果への直接加算(%)。
export const MORALE_BOOST_VALUES: Record<
  CookingBuffState['moraleBoostVariant'],
  { mainStat: number; percent: number }
> = {
  forestHeal: { mainStat: 400, percent: 3 },
  mightBloom: { mainStat: 200, percent: 1.5 },
};

// 能力共鳴(響奏)の平均倍率(%)の選択肢。
export const RESONANCE_MULTIPLIER_OPTIONS = [8, 12, 16, 24, 32] as const;

// 鼓舞のpercent効果(最終計算結果への直接加算)の対象ステータス。
export const MORALE_BOOST_PERCENT_STAT_IDS: StatId[] = [
  'crit',
  'haste',
  'luck',
  'mastery',
  'versatility',
];

// 能力共鳴(響奏): 基準値×倍率(%)÷100を算出する。
export function calcResonanceBonus(cookingBuff: CookingBuffState): number {
  if (!cookingBuff.resonanceEnabled || cookingBuff.resonanceBaseValue === 0) return 0;
  return (cookingBuff.resonanceBaseValue * cookingBuff.resonanceMultiplierPercent) / 100;
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
