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
};

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
