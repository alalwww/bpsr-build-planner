import { describe, expect, it } from 'vitest';
import type { StatId } from '../types';
import { computeCookingAdjustments, INSPIRATION_PERCENT_STAT_IDS } from './cookingBuff';

function zeroStats(): Record<StatId, number> {
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

describe('computeCookingAdjustments', () => {
  it('returns no adjustments when every bonus is zero', () => {
    expect(computeCookingAdjustments(zeroStats(), 'atk', 0, 0, 0, 0)).toEqual([]);
  });

  it('applies adaptability multiplier then cooking addend to the same stat, in order', () => {
    const stats = { ...zeroStats(), atk: 100 };
    const adjustments = computeCookingAdjustments(stats, 'atk', 50, 0, 0, 20);

    expect(adjustments).toEqual([
      { statId: 'atk', multiplier: 1.2 },
      { statId: 'atk', addend: 50 },
    ]);
  });

  it('adds moralePercentBonus to every INSPIRATION_PERCENT_STAT_IDS entry', () => {
    const adjustments = computeCookingAdjustments(zeroStats(), 'atk', 0, 5, 0, 0);

    expect(adjustments).toEqual(
      INSPIRATION_PERCENT_STAT_IDS.map((statId) => ({ statId, addend: 5 })),
    );
  });

  it('picks the currently-highest INSPIRATION_PERCENT_STAT_IDS entry for the hpShift addend', () => {
    const stats = { ...zeroStats(), crit: 10, haste: 200, luck: 90, mastery: 5, versatility: 5 };

    const adjustments = computeCookingAdjustments(stats, 'atk', 0, 0, 15, 0);

    expect(adjustments).toEqual([{ statId: 'haste', addend: 15 }]);
  });

  it('applies all four adjustments together in the documented order (adaptability, cooking, morale, hpShift)', () => {
    const stats = {
      ...zeroStats(),
      atk: 100,
      crit: 10,
      haste: 20,
      luck: 30,
      mastery: 5,
      versatility: 5,
    };

    const adjustments = computeCookingAdjustments(stats, 'atk', 25, 5, 15, 10);

    expect(adjustments).toEqual([
      { statId: 'atk', multiplier: 1.1 },
      { statId: 'atk', addend: 25 },
      { statId: 'crit', addend: 5 },
      { statId: 'haste', addend: 5 },
      { statId: 'luck', addend: 5 },
      { statId: 'mastery', addend: 5 },
      { statId: 'versatility', addend: 5 },
      // luck (30) is highest before hpShift, and morale adds +5 uniformly so it stays highest.
      { statId: 'luck', addend: 15 },
    ]);
  });
});
