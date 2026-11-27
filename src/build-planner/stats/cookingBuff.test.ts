import { describe, expect, it } from 'vitest';
import { PROFESSIONS } from '../profession';
import type { StatId } from '../types';
import { STAT_CORRECTION_ADD_LIMIT, STAT_CORRECTION_ADD_LIMIT_MAX_HP } from '../types';
import { BASE_STATS } from './baseStats';
import {
  applyCookingBuff,
  computeCookingAdjustments,
  DEFAULT_COOKING_BUFF,
  getStatCorrectionAddLimit,
  getStatCorrectionTargets,
  INSPIRATION_PERCENT_STAT_IDS,
} from './cookingBuff';
import { SEASON_CONSTANTS } from './seasonConstants';

function zeroStats(): Record<StatId, number> {
  return Object.fromEntries(
    (Object.keys(BASE_STATS) as StatId[]).map((statId) => [statId, 0]),
  ) as Record<StatId, number>;
}

describe('computeCookingAdjustments', () => {
  it('returns no adjustments when every bonus is zero', () => {
    expect(computeCookingAdjustments(zeroStats(), 'atk', 0, 0, 0, 0, 0, zeroStats())).toEqual([]);
  });

  it('applies adaptability multiplier then cooking addend to the same stat, in order', () => {
    const stats = { ...zeroStats(), atk: 100 };
    const adjustments = computeCookingAdjustments(stats, 'atk', 50, 0, 0, 0, 20, zeroStats());

    expect(adjustments).toEqual([
      { statId: 'atk', multiplier: 1.2 },
      { statId: 'atk', addend: 50 },
    ]);
  });

  it('adds moralePercentBonus to every INSPIRATION_PERCENT_STAT_IDS entry', () => {
    const adjustments = computeCookingAdjustments(zeroStats(), 'atk', 0, 5, 0, 0, 0, zeroStats());

    expect(adjustments).toEqual(
      INSPIRATION_PERCENT_STAT_IDS.map((statId) => ({ statId, addend: 5 })),
    );
  });

  it('picks the highest INSPIRATION_PERCENT_STAT_IDS entry by raw value (not final %) for the highestStatFinalPctBonus addend (e.g. フロストメイジ「二段増幅」)', () => {
    // haste has the highest *final %* (200), but luck has the highest *raw value* (500). The
    // ability's "highest stat" judgement is based on the pre-diminishing-curve raw value, so it
    // must target luck here, not haste.
    const finalStats = {
      ...zeroStats(),
      crit: 10,
      haste: 200,
      luck: 90,
      mastery: 5,
      versatility: 5,
    };
    const rawStats = { ...zeroStats(), crit: 8, haste: 40, luck: 500, mastery: 5, versatility: 5 };

    const adjustments = computeCookingAdjustments(finalStats, 'atk', 0, 0, 35, 0, 0, rawStats);

    expect(adjustments).toEqual([{ statId: 'luck', addend: 35 }]);
  });

  it('picks the currently-highest INSPIRATION_PERCENT_STAT_IDS entry by final % (not raw value) for the hpShift addend (HP変動/パワーコア)', () => {
    // Mirror image of the 二段増幅 case above: haste has the highest *final %* (200) while luck
    // has the highest *raw value* (500). HP変動 targets the final % max, so it must land on
    // haste here, unlike 二段増幅 which would target luck (bug report 2026-08-05: HP変動 was
    // incorrectly switched to the raw-value basis alongside 二段増幅's fix).
    const finalStats = {
      ...zeroStats(),
      crit: 10,
      haste: 200,
      luck: 90,
      mastery: 5,
      versatility: 5,
    };
    const rawStats = { ...zeroStats(), crit: 8, haste: 40, luck: 500, mastery: 5, versatility: 5 };

    const adjustments = computeCookingAdjustments(finalStats, 'atk', 0, 0, 0, 15, 0, rawStats);

    expect(adjustments).toEqual([{ statId: 'haste', addend: 15 }]);
  });

  it('applies highestStatFinalPctBonus (raw basis) then hpShift (final % basis) independently, landing on different stats', () => {
    // luck has the highest raw value (500) so highestStatFinalPctBonus lands on luck, pushing its
    // final % from 90 to 125 -- still below haste's 200, so hpShift lands on haste instead.
    const finalStats = {
      ...zeroStats(),
      crit: 10,
      haste: 200,
      luck: 90,
      mastery: 5,
      versatility: 5,
    };
    const rawStats = { ...zeroStats(), crit: 8, haste: 40, luck: 500, mastery: 5, versatility: 5 };

    const adjustments = computeCookingAdjustments(finalStats, 'atk', 0, 0, 35, 15, 0, rawStats);

    expect(adjustments).toEqual([
      { statId: 'luck', addend: 35 },
      { statId: 'haste', addend: 15 },
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
    const rawStats = { ...zeroStats(), crit: 10, haste: 20, luck: 30, mastery: 5, versatility: 5 };

    const adjustments = computeCookingAdjustments(stats, 'atk', 25, 5, 35, 15, 10, rawStats);

    expect(adjustments).toEqual([
      { statId: 'atk', multiplier: 1.1 },
      { statId: 'atk', addend: 25 },
      { statId: 'crit', addend: 5 },
      { statId: 'haste', addend: 5 },
      { statId: 'luck', addend: 5 },
      { statId: 'mastery', addend: 5 },
      { statId: 'versatility', addend: 5 },
      // luck has the highest raw value (30), so highestStatFinalPctBonus lands on luck.
      { statId: 'luck', addend: 35 },
      // luck (70) is also still highest by final % going into hpShift.
      { statId: 'luck', addend: 15 },
    ]);
  });

  it('adds a statCorrections finalValue addend after every other adjustment, skipping zero entries', () => {
    const adjustments = computeCookingAdjustments(zeroStats(), 'atk', 0, 0, 0, 0, 0, zeroStats(), {
      maxHp: { add: 999, multPercent: 999, finalValue: 500 },
      crit: { add: 0, multPercent: 0, finalValue: 0 },
      haste: { add: 0, multPercent: 0, finalValue: -25 },
    });

    // maxHp/haste's finalValue is applied as a plain addend; crit is all-zero so it's skipped
    // entirely (statCorrections' add/multPercent fields are handled upstream in
    // calculateRawStats, not here, so they're irrelevant to this function).
    expect(adjustments).toEqual([
      { statId: 'maxHp', addend: 500 },
      { statId: 'haste', addend: -25 },
    ]);
  });
  it('multiplies the final % (after hpShift and statCorrections) by the summed finalPctMultiplierBonus (追撃の風・右刃/左刃)', () => {
    // 2026-11-28実機計測: 会心17.2%(HP変動込み) → 片方19.26% → 両方21.32%、幸運5% → 4.5% → 4%。
    const finalStats = { ...zeroStats(), crit: 7.2, luck: 5 };
    const adjustments = computeCookingAdjustments(
      finalStats,
      'atk',
      0,
      0,
      0,
      10,
      0,
      zeroStats(),
      {},
      0,
      { crit: 2400, luck: -2000 },
    );

    // 乗算の結果は加算値に換算して返す(最終値 × (係数 - 1))。HP変動の+10が先に乗った17.2に対して×1.24。
    expect(adjustments.map((a) => a.statId)).toEqual(['crit', 'crit', 'luck']);
    expect(adjustments[0]).toEqual({ statId: 'crit', addend: 10 });
    expect(adjustments[1].finalMultiplierAddend).toBeCloseTo(17.2 * 0.24, 10);
    expect(adjustments[2].finalMultiplierAddend).toBeCloseTo(-1, 10);
    expect(17.2 + (adjustments[1].finalMultiplierAddend ?? 0)).toBeCloseTo(21.328, 10);
    expect(5 + (adjustments[2].finalMultiplierAddend ?? 0)).toBeCloseTo(4, 10);
  });

  it('adds atk by the final haste % over the threshold, based on pre-cooking final atk (臣狼の爪)', () => {
    // ファスト30% + HP変動10% = 40% → 35%超過分5% × 0.2% = 攻撃力+1%。
    // 基準は料理系調整前の攻撃力(1000)。適応力(+20%)・料理加算(+50)は基準に含めない。
    const finalStats = { ...zeroStats(), atk: 1000, haste: 30 };
    const adjustments = computeCookingAdjustments(
      finalStats,
      'atk',
      50,
      0,
      0,
      10,
      20,
      zeroStats(),
      {},
      0,
      {},
      [{ thresholdPercent: 35, atkPercentPerHastePercent: 0.2 }],
    );

    expect(adjustments).toEqual([
      { statId: 'atk', multiplier: 1.2 },
      { statId: 'atk', addend: 50 },
      { statId: 'haste', addend: 10 },
      { statId: 'atk', addend: 10 },
    ]);
  });

  it('skips the haste-excess atk bonus when final haste does not exceed the threshold', () => {
    const finalStats = { ...zeroStats(), atk: 1000, haste: 35 };
    const adjustments = computeCookingAdjustments(
      finalStats,
      'atk',
      0,
      0,
      0,
      0,
      0,
      zeroStats(),
      {},
      0,
      {},
      [{ thresholdPercent: 35, atkPercentPerHastePercent: 0.2 }],
    );

    expect(adjustments).toEqual([]);
  });
});

describe('料理の精鋭ダメージ → 汎用ダメージアップ(damageBonus)', () => {
  it('料理が有効なときだけ、精鋭ダメージ%を "100=1%" で返す', () => {
    expect(
      applyCookingBuff({
        ...DEFAULT_COOKING_BUFF,
        cookingEnabled: true,
        cookingEliteDamagePercent: 5,
      }).damageBonus,
    ).toBe(500);
    expect(
      applyCookingBuff({
        ...DEFAULT_COOKING_BUFF,
        cookingEnabled: false,
        cookingEliteDamagePercent: 10,
      }).damageBonus,
    ).toBe(0);
  });

  it('computeCookingAdjustments は damageBonus への加算を出す', () => {
    const adjustments = computeCookingAdjustments(
      zeroStats(),
      'atk',
      0,
      0,
      0,
      0,
      0,
      zeroStats(),
      {},
      1000,
    );
    expect(adjustments).toEqual([{ statId: 'damageBonus', addend: 1000 }]);
  });
});

describe('getStatCorrectionTargets', () => {
  it('resolves atk/matk per profession, always lists all three base stats, and flags the percent-based stats', () => {
    const targets = getStatCorrectionTargets(PROFESSIONS.stormBlade);

    expect(targets).toEqual([
      { id: 'maxHp', isPercent: false },
      { id: 'atk', isPercent: false }, // stormBlade is a physical attacker
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
    ]);
  });
});

describe('getStatCorrectionAddLimit', () => {
  it('uses the season diminishing constant for percent stats a dedicated limit for maxHp, and the default for others', () => {
    expect(getStatCorrectionAddLimit('crit')).toBe(SEASON_CONSTANTS.diminishingA);
    expect(getStatCorrectionAddLimit('haste')).toBe(SEASON_CONSTANTS.diminishingA);
    expect(getStatCorrectionAddLimit('luck')).toBe(SEASON_CONSTANTS.diminishingA);
    expect(getStatCorrectionAddLimit('mastery')).toBe(SEASON_CONSTANTS.diminishingA);
    expect(getStatCorrectionAddLimit('versatility')).toBe(SEASON_CONSTANTS.diminishingVersatility);
    expect(getStatCorrectionAddLimit('atk')).toBe(STAT_CORRECTION_ADD_LIMIT);
    expect(getStatCorrectionAddLimit('maxHp')).toBe(STAT_CORRECTION_ADD_LIMIT_MAX_HP);
  });
});
