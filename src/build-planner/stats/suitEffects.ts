import { getTalentSchoolId } from '../equipment/equipmentData';
import { suitsData } from '../equipment/equipmentSlotPickerData';
import type { Profession, ProfessionTypeKey } from '../profession';
import type { EquippedItems } from '../types';

// レイドセット効果のうち、ゲーム内の戦闘状態(スタック数・対象のHP等)ではなく現在ステータスの
// 閾値だけで反映先が決まる、プランナーで計算可能な条件付き効果。値は攻撃速度%の閾値と、
// 閾値未満の場合に加算する攻撃速度%(閾値以上の場合の効果はスキル固有ダメージ%等、
// StatId/DerivedStats側に対応する項目がないため対象外)。
export interface SuitAtkSpeedThresholdEffect {
  thresholdPercent: number;
  belowThresholdBonusPercent: number;
}

// buffId → 条件付き攻撃速度効果。S2セット(suitId 101)ストームブレイド月影型(school 102)の
// 2点セット効果(buffId 2401260、「攻撃速度が80%未満の場合、攻撃速度+6%。攻撃速度が80%以上の
// 場合、マスタリースキルの雷属性ダメージ+7%」)のみ該当(2026-08-05不具合報告で判明。他の
// suits.json全effectの説明文を確認したが、同様の"現在ステータス閾値で分岐する"効果は他になし。
// 光盾障壁のスタック数・対象の残りHP等に依存する効果はゲーム内の戦闘状態依存のため対象外)。
export const SUIT_ATK_SPEED_THRESHOLD_EFFECTS: Partial<
  Record<number, SuitAtkSpeedThresholdEffect>
> = {
  2401260: { thresholdPercent: 80, belowThresholdBonusPercent: 6 },
};

// 装備中セットのうち、現在のクラス型(talentSchoolId)に対応するeffectsを持ち、かつ
// 装備数がtier.limitNumを満たしている(=発動中の)buffIdを全て集める(4点セット時は
// 2点分の効果も重複して発動するため、limitNum以上の全tierを対象にする)。
function getActiveSuitBuffIds(equippedItems: EquippedItems, talentSchoolId: number): number[] {
  const suitCounts: Record<number, number> = {};
  for (const item of Object.values(equippedItems)) {
    if (item?.suitId) suitCounts[item.suitId] = (suitCounts[item.suitId] ?? 0) + 1;
  }
  const buffIds: number[] = [];
  for (const [suitIdStr, suitDataEntry] of Object.entries(suitsData)) {
    const count = suitCounts[Number(suitIdStr)] ?? 0;
    for (const tier of suitDataEntry.tiers) {
      if (count < tier.limitNum) continue;
      const effect = tier.effects[String(talentSchoolId)];
      if (effect) buffIds.push(effect.buffId);
    }
  }
  return buffIds;
}

// 装備中セット効果のうち、現在の攻撃速度%を閾値判定に使う条件付き効果の加算量(%)を返す。
// currentAtkSpeedPercentには、finalPctAddend/イマジン最終%乗算/料理バフ等すべてが確定した
// 後の最終攻撃速度%(この効果自身の加算は含まない)を渡すこと。
export function calculateSuitAtkSpeedBonus(
  equippedItems: EquippedItems,
  profession: Profession,
  professionTypeKey: ProfessionTypeKey,
  currentAtkSpeedPercent: number,
): number {
  const talentSchoolId = getTalentSchoolId(profession, professionTypeKey);
  const buffIds = getActiveSuitBuffIds(equippedItems, talentSchoolId);
  let bonus = 0;
  for (const buffId of buffIds) {
    const effect = SUIT_ATK_SPEED_THRESHOLD_EFFECTS[buffId];
    if (!effect) continue;
    if (currentAtkSpeedPercent < effect.thresholdPercent) {
      bonus += effect.belowThresholdBonusPercent;
    }
  }
  return bonus;
}
