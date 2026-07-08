import { describe, expect, it } from 'vitest';
import { PROFESSIONS } from '../profession';
import type { StatId } from '../types';
import { COMMON_STAT_COEFFICIENTS } from './commonCoefficients';
import { deriveStats } from './deriveStats';
import { diminishingPercent } from './formulas';
import {
  DIMINISHING_A_BASE_PERCENT,
  FIXED_BASE_PERCENT,
  SEASON_CONSTANTS,
} from './seasonConstants';

function zeroRaw(): Record<StatId, number> {
  return {
    maxHp: 0,
    atk: 0,
    matk: 0,
    physicalDef: 0,
    magicalDef: 0,
    strength: 0,
    agility: 0,
    intellect: 0,
    endurance: 0,
    illusionPower: 0,
    crit: 0,
    haste: 0,
    luck: 0,
    mastery: 0,
    versatility: 0,
    resist: 0,
    allAttrResist: 0,
    allAttrStr: 0,
    refinePhysAtk: 0,
    refineMagAtk: 0,
    refineDef: 0,
    receivedRecovery: 0,
    barrierStrength: 0,
    staminaRegen: 0,
    physicalEnhance: 0,
    magicalEnhance: 0,
    critDamageBonus: 0,
    luckyHitDamageBonus: 0,
    critRecoveryBonus: 0,
  };
}

describe('deriveStats', () => {
  it('degenerates every diminishing-returns stat to its base percentage when raw is all zero', () => {
    const result = deriveStats(zeroRaw(), PROFESSIONS.stormBlade);

    expect(result.maxHp).toBe(0);
    expect(result.physicalAtk).toBe(0);
    expect(result.magicalAtk).toBe(0);
    expect(result.physicalDef).toBe(0);
    expect(result.magicalDef).toBe(0);
    expect(result.critPercent).toBe(DIMINISHING_A_BASE_PERCENT.crit);
    expect(result.hastePercent).toBe(DIMINISHING_A_BASE_PERCENT.haste);
    expect(result.luckPercent).toBe(DIMINISHING_A_BASE_PERCENT.luck);
    expect(result.masteryPercent).toBe(DIMINISHING_A_BASE_PERCENT.mastery);
    expect(result.versatilityPercent).toBe(0);
    expect(result.resistPercent).toBe(DIMINISHING_A_BASE_PERCENT.resist);
    expect(result.physicalBoostPercent).toBe(0);
    expect(result.magicalBoostPercent).toBe(0);
    expect(result.staminaRegenPerSecond).toBe(PROFESSIONS.stormBlade.staminaRegenPerSecond);
  });

  it('routes the main stat bonus to physicalAtk for a physical attacker (stormBlade, mainStat=agility)', () => {
    const profession = PROFESSIONS.stormBlade;
    const raw: Record<StatId, number> = {
      ...zeroRaw(),
      maxHp: 1000,
      atk: 500,
      matk: 300,
      physicalDef: 200,
      magicalDef: 150,
      strength: 100,
      agility: 200,
      intellect: 50,
      endurance: 80,
      crit: 3000,
      haste: 2000,
      luck: 1000,
      mastery: 4000,
      versatility: 2000,
      resist: 500,
      staminaRegen: 10,
      physicalEnhance: 3000,
      magicalEnhance: 1000,
      critDamageBonus: 500,
      luckyHitDamageBonus: 300,
      critRecoveryBonus: 200,
    };

    const result = deriveStats(raw, profession);

    expect(result.maxHp).toBe(raw.maxHp + raw.endurance * profession.hpPerEndurancePoint);
    expect(result.physicalAtk).toBe(raw.atk + raw.agility * profession.atkPerMainStatPoint);
    expect(result.magicalAtk).toBe(raw.matk);
    expect(result.physicalDef).toBe(
      raw.physicalDef + raw.strength * COMMON_STAT_COEFFICIENTS.physicalDefPerStrengthPoint,
    );
    expect(result.magicalDef).toBe(
      raw.magicalDef + raw.intellect * COMMON_STAT_COEFFICIENTS.magicalDefPerIntellectPoint,
    );

    expect(result.critPercent).toBeCloseTo(
      diminishingPercent(raw.crit, SEASON_CONSTANTS.diminishingA, DIMINISHING_A_BASE_PERCENT.crit),
    );
    const hasteReal = raw.haste + raw.agility * COMMON_STAT_COEFFICIENTS.hastePerAgilityPoint;
    expect(result.hastePercent).toBeCloseTo(
      diminishingPercent(
        hasteReal,
        SEASON_CONSTANTS.diminishingA,
        DIMINISHING_A_BASE_PERCENT.haste,
      ),
    );
    expect(result.atkSpeedPercent).toBeCloseTo(
      result.hastePercent * profession.atkSpeedPerHastePercent,
    );
    expect(result.castSpeedPercent).toBeCloseTo(
      result.hastePercent * profession.castSpeedPerHastePercent,
    );

    expect(result.luckPercent).toBeCloseTo(
      diminishingPercent(raw.luck, SEASON_CONSTANTS.diminishingA, DIMINISHING_A_BASE_PERCENT.luck),
    );
    expect(result.luckyHitDamageMultiplierPercent).toBeCloseTo(
      FIXED_BASE_PERCENT.luckyHitDamage + 0.25 * result.luckPercent + raw.luckyHitDamageBonus / 100,
    );
    expect(result.luckyHitBoostPercent).toBe(result.luckPercent);

    expect(result.masteryPercent).toBeCloseTo(
      diminishingPercent(
        raw.mastery,
        SEASON_CONSTANTS.diminishingA,
        DIMINISHING_A_BASE_PERCENT.mastery,
      ),
    );

    expect(result.versatilityPercent).toBeCloseTo(
      diminishingPercent(raw.versatility, SEASON_CONSTANTS.diminishingVersatility),
    );
    expect(result.versatilityDamageBonusPercent).toBeCloseTo(result.versatilityPercent * 0.35);
    expect(result.versatilityDamageReductionPercent).toBeCloseTo(result.versatilityPercent * 0.15);

    expect(result.resistPercent).toBeCloseTo(
      diminishingPercent(
        raw.resist,
        SEASON_CONSTANTS.diminishingA,
        DIMINISHING_A_BASE_PERCENT.resist,
      ),
    );
    expect(result.resistDamageReductionPercent).toBe(FIXED_BASE_PERCENT.resistDamageReduction);

    expect(result.physicalBoostPercent).toBeCloseTo(
      diminishingPercent(raw.physicalEnhance, SEASON_CONSTANTS.diminishingEnhance),
    );
    expect(result.magicalBoostPercent).toBeCloseTo(
      diminishingPercent(raw.magicalEnhance, SEASON_CONSTANTS.diminishingEnhance),
    );

    expect(result.critDamageBonusPercent).toBe(
      FIXED_BASE_PERCENT.critDamage + raw.critDamageBonus / 100,
    );
    expect(result.critRecoveryPercent).toBe(
      FIXED_BASE_PERCENT.critRecovery + raw.critRecoveryBonus / 100,
    );
    expect(result.staminaRegenPerSecond).toBe(profession.staminaRegenPerSecond + raw.staminaRegen);
  });

  it('routes the main stat bonus to magicalAtk for a magical attacker (frostMage, mainStat=intellect)', () => {
    const profession = PROFESSIONS.frostMage;
    const raw: Record<StatId, number> = {
      ...zeroRaw(),
      atk: 100,
      matk: 200,
      intellect: 150,
      agility: 999, // 物理攻撃側のメインステータスではないため無視されることを確認
    };

    const result = deriveStats(raw, profession);

    expect(result.physicalAtk).toBe(raw.atk);
    expect(result.magicalAtk).toBe(raw.matk + raw.intellect * profession.atkPerMainStatPoint);
  });
});
