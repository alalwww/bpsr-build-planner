import { describe, expect, it } from 'vitest';
import type { StatId } from '../types';
import { BASE_STATS } from './baseStats';
import { computeCookingAdjustments, INSPIRATION_PERCENT_STAT_IDS } from './cookingBuff';

function zeroStats(): Record<StatId, number> {
  return Object.fromEntries(
    (Object.keys(BASE_STATS) as StatId[]).map((statId) => [statId, 0]),
  ) as Record<StatId, number>;
}

describe('computeCookingAdjustments', () => {
  it('returns no adjustments when every bonus is zero', () => {
    expect(computeCookingAdjustments(zeroStats(), 'atk', 0, 0, 0, 0, 0)).toEqual([]);
  });

  it('applies adaptability multiplier then cooking addend to the same stat, in order', () => {
    const stats = { ...zeroStats(), atk: 100 };
    const adjustments = computeCookingAdjustments(stats, 'atk', 50, 0, 0, 0, 20);

    expect(adjustments).toEqual([
      { statId: 'atk', multiplier: 1.2 },
      { statId: 'atk', addend: 50 },
    ]);
  });

  it('adds moralePercentBonus to every INSPIRATION_PERCENT_STAT_IDS entry', () => {
    const adjustments = computeCookingAdjustments(zeroStats(), 'atk', 0, 5, 0, 0, 0);

    expect(adjustments).toEqual(
      INSPIRATION_PERCENT_STAT_IDS.map((statId) => ({ statId, addend: 5 })),
    );
  });

  it('picks the currently-highest INSPIRATION_PERCENT_STAT_IDS entry for the highestStatFinalPctBonus addend (e.g. フロストメイジ「二段増幅」)', () => {
    const stats = { ...zeroStats(), crit: 10, haste: 200, luck: 90, mastery: 5, versatility: 5 };

    const adjustments = computeCookingAdjustments(stats, 'atk', 0, 0, 35, 0, 0);

    expect(adjustments).toEqual([{ statId: 'haste', addend: 35 }]);
  });

  it('picks the currently-highest INSPIRATION_PERCENT_STAT_IDS entry for the hpShift addend', () => {
    const stats = { ...zeroStats(), crit: 10, haste: 200, luck: 90, mastery: 5, versatility: 5 };

    const adjustments = computeCookingAdjustments(stats, 'atk', 0, 0, 0, 15, 0);

    expect(adjustments).toEqual([{ statId: 'haste', addend: 15 }]);
  });

  it('applies highestStatFinalPctBonus and hpShift sequentially, each re-checking the current max', () => {
    // versatility (30) starts highest; +35 pushes it further ahead, so hpShift also targets it.
    const stats = { ...zeroStats(), crit: 10, haste: 20, luck: 25, mastery: 5, versatility: 30 };

    const adjustments = computeCookingAdjustments(stats, 'atk', 0, 0, 35, 15, 0);

    expect(adjustments).toEqual([
      { statId: 'versatility', addend: 35 },
      { statId: 'versatility', addend: 15 },
    ]);
  });

  it('applies all five adjustments together in the documented order (adaptability, cooking, morale, highestStatFinalPctBonus, hpShift)', () => {
    const stats = {
      ...zeroStats(),
      atk: 100,
      crit: 10,
      haste: 20,
      luck: 30,
      mastery: 5,
      versatility: 5,
    };

    const adjustments = computeCookingAdjustments(stats, 'atk', 25, 5, 35, 15, 10);

    expect(adjustments).toEqual([
      { statId: 'atk', multiplier: 1.1 },
      { statId: 'atk', addend: 25 },
      { statId: 'crit', addend: 5 },
      { statId: 'haste', addend: 5 },
      { statId: 'luck', addend: 5 },
      { statId: 'mastery', addend: 5 },
      { statId: 'versatility', addend: 5 },
      // luck (30) is highest before highestStatFinalPctBonus, and morale adds +5 uniformly so it stays highest.
      { statId: 'luck', addend: 35 },
      // luck (70) is still highest going into hpShift.
      { statId: 'luck', addend: 15 },
    ]);
  });
});
