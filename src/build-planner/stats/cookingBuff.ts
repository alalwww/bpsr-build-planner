import type { CookingBuffState } from '../types';

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
};

// 海風の宴によるメインステータス(筋力/知力/俊敏)への加算量。他のメインステータス加算源と同様に
// %ボーナス適用前に加算するため、calculateRawStatsのaddStat内で直接この定数を使用する。
export const SEA_BREEZE_MAIN_STAT_BONUS = 500;

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
