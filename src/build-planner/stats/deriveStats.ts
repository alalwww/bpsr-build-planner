import type { Profession } from '../profession';
import type { StatId } from '../types';
import { COMMON_STAT_COEFFICIENTS } from './commonCoefficients';
import { diminishingPercent } from './formulas';
import {
  DIMINISHING_A_BASE_PERCENT,
  FIXED_BASE_PERCENT,
  SEASON_CONSTANTS,
} from './seasonConstants';

// docs/STATUS_CALCULATION.md に記載した式から導出される、実数値ステータスでは
// 直接表現できないステータス群(%変換後の値、クラス係数で導出される値)。
export interface DerivedStats {
  maxHp: number;
  physicalAtk: number;
  magicalAtk: number;
  physicalDef: number;
  magicalDef: number;

  critPercent: number;
  // 会心発生時のダメージ増加率(現状ステータスとしては存在せず、固定の基礎値)
  critDamageBonusPercent: number;

  // %変換前の実数値(装備等のhaste加算 + 俊敏由来の変換分)。CharacterPanelのツールチップ表示用。
  hasteReal: number;
  hastePercent: number;
  atkSpeedPercent: number;
  castSpeedPercent: number;

  luckPercent: number;
  // 幸運の一撃が発生した際、攻撃力に乗算するダメージ倍率(%)
  luckyHitDamageMultiplierPercent: number;
  // 幸運増強(幸運の一撃を含むすべての幸運効果に乗る与ダメージ増加バフ。幸運%と同値)
  luckyHitBoostPercent: number;

  masteryPercent: number;

  versatilityPercent: number;
  // 万能由来の、与ダメージ/回復量/バリア付与量の増加率(他の効果と乗算される)
  versatilityDamageBonusPercent: number;
  // 万能由来の、被ダメージの軽減率(他の効果と乗算される)
  versatilityDamageReductionPercent: number;

  resistPercent: number;
  // レジスト発生時の被ダメージ軽減率(現状ステータスとしては存在せず、固定の基礎値)
  resistDamageReductionPercent: number;

  // 物理/魔法増強(系列C): 与える物理/魔法ダメージ・回復量の増加率
  physicalBoostPercent: number;
  magicalBoostPercent: number;

  // 会心回復(回復時に会心が発生した場合の回復量増加率。基礎値+装備等の加算)
  critRecoveryPercent: number;

  // 戦闘時のスタミナ秒間回復量(クラス基礎値 + 心相ツリー等由来の加算)
  staminaRegenPerSecond: number;
}

export function deriveStats(
  raw: Record<StatId, number>,
  profession: Profession,
  // R1アビリティ(type=4効果)によるメインステータス→攻撃力/物理防御力/ファストの変換率ボーナス。
  // calculateRawStatsのconversionRateBonusをそのまま渡す(未指定時は基礎変換率のみ)。
  conversionRateBonus: Partial<Record<StatId, number>> = {},
): DerivedStats {
  const maxHp = raw.maxHp + raw.endurance * profession.hpPerEndurancePoint;

  const atkTargetStat: StatId = profession.attackType === 'physical' ? 'atk' : 'matk';
  const mainStatBonus =
    raw[profession.mainStat] *
    (profession.atkPerMainStatPoint + (conversionRateBonus[atkTargetStat] ?? 0));
  const physicalAtk = raw.atk + (profession.attackType === 'physical' ? mainStatBonus : 0);
  const magicalAtk = raw.matk + (profession.attackType === 'magical' ? mainStatBonus : 0);

  const physicalDef =
    raw.physicalDef +
    raw.strength *
      (COMMON_STAT_COEFFICIENTS.physicalDefPerStrengthPoint +
        (conversionRateBonus.physicalDef ?? 0));
  const magicalDef =
    raw.magicalDef + raw.intellect * COMMON_STAT_COEFFICIENTS.magicalDefPerIntellectPoint;

  const critPercent = diminishingPercent(
    raw.crit,
    SEASON_CONSTANTS.diminishingA,
    DIMINISHING_A_BASE_PERCENT.crit,
  );

  const hasteReal =
    raw.haste +
    raw.agility *
      (COMMON_STAT_COEFFICIENTS.hastePerAgilityPoint + (conversionRateBonus.haste ?? 0));
  const hastePercent = diminishingPercent(
    hasteReal,
    SEASON_CONSTANTS.diminishingA,
    DIMINISHING_A_BASE_PERCENT.haste,
  );

  const luckPercent = diminishingPercent(
    raw.luck,
    SEASON_CONSTANTS.diminishingA,
    DIMINISHING_A_BASE_PERCENT.luck,
  );

  const masteryPercent = diminishingPercent(
    raw.mastery,
    SEASON_CONSTANTS.diminishingA,
    DIMINISHING_A_BASE_PERCENT.mastery,
  );

  const versatilityPercent = diminishingPercent(
    raw.versatility,
    SEASON_CONSTANTS.diminishingVersatility,
  );

  const resistPercent = diminishingPercent(
    raw.resist,
    SEASON_CONSTANTS.diminishingA,
    DIMINISHING_A_BASE_PERCENT.resist,
  );

  const physicalBoostPercent = diminishingPercent(
    raw.physicalEnhance,
    SEASON_CONSTANTS.diminishingEnhance,
  );
  const magicalBoostPercent = diminishingPercent(
    raw.magicalEnhance,
    SEASON_CONSTANTS.diminishingEnhance,
  );

  return {
    maxHp,
    physicalAtk,
    magicalAtk,
    physicalDef,
    magicalDef,

    critPercent,
    critDamageBonusPercent: FIXED_BASE_PERCENT.critDamage + raw.critDamageBonus / 100,

    hasteReal,
    hastePercent,
    atkSpeedPercent: hastePercent * profession.atkSpeedPerHastePercent,
    castSpeedPercent: hastePercent * profession.castSpeedPerHastePercent,

    luckPercent,
    luckyHitDamageMultiplierPercent:
      FIXED_BASE_PERCENT.luckyHitDamage + 0.25 * luckPercent + raw.luckyHitDamageBonus / 100,
    luckyHitBoostPercent: luckPercent,

    masteryPercent,

    versatilityPercent,
    versatilityDamageBonusPercent: versatilityPercent * 0.35,
    versatilityDamageReductionPercent: versatilityPercent * 0.15,

    resistPercent,
    resistDamageReductionPercent: FIXED_BASE_PERCENT.resistDamageReduction,

    physicalBoostPercent,
    magicalBoostPercent,

    critRecoveryPercent: FIXED_BASE_PERCENT.critRecovery + raw.critRecoveryBonus / 100,

    staminaRegenPerSecond: profession.staminaRegenPerSecond + raw.staminaRegen,
  };
}
