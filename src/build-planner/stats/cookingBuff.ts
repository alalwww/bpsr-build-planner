import type { Profession } from '../profession';
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
};

// 海風の宴によるメインステータス(筋力/知力/俊敏)への加算量。
const SEA_BREEZE_MAIN_STAT_BONUS = 500;

export interface CookingBuffResult {
  // 海風の宴の+500を反映した後のrawStats(deriveStatsの物理/魔法攻撃力計算に使うため、
  // メインステータス自体にも加算した状態で返す)。
  rawStats: Record<StatId, number>;
  // 料理バフ表示用: メインステータスへの料理攻撃力加算量(海風の宴、0=なし)。
  mainStatBonus: number;
  // 料理バフ表示用: 最終atk/matkへの料理攻撃力加算量(料理、0=なし)。
  atkBonus: number;
}

// 料理バフ(海風の宴・料理)を適用する。装備・アビリティ等の加算・乗算計算がすべて
// 終わった後の値に対して加算するため、rawStats算出後・deriveStats算出前にこの関数を呼ぶ。
export function applyCookingBuff(
  rawStats: Record<StatId, number>,
  profession: Profession,
  cookingBuff: CookingBuffState,
): CookingBuffResult {
  const mainStatBonus = cookingBuff.seaBreezeEnabled ? SEA_BREEZE_MAIN_STAT_BONUS : 0;
  const atkBonus = cookingBuff.cookingEnabled ? cookingBuff.cookingAtkValue : 0;
  if (mainStatBonus === 0) {
    return { rawStats, mainStatBonus, atkBonus };
  }
  return {
    rawStats: {
      ...rawStats,
      [profession.mainStat]: rawStats[profession.mainStat] + mainStatBonus,
    },
    mainStatBonus,
    atkBonus,
  };
}
