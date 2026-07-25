import { describe, expect, it } from 'vitest';
import { truncate2 } from '../character/statFormat';
import { calculateMasteryElementBonus } from './masteryElementBonus';

describe('calculateMasteryElementBonus', () => {
  it('returns null for a class/type with no elemental-bonus mastery effect', () => {
    expect(calculateMasteryElementBonus('heavyGuardian', 'type1', 6)).toBeNull();
  });

  it('returns null when mastery is 0', () => {
    expect(calculateMasteryElementBonus('frostMage', 'type1', 0)).toBeNull();
  });

  it('applies the flat rate for フロストメイジ氷牙型 (0.65%/pt, no rate boost)', () => {
    const result = calculateMasteryElementBonus('frostMage', 'type1', 6);

    expect(result).not.toBeNull();
    expect(result!.statId).toBe('iceBonus');
    // 6% * 0.65 = 3.9% → rawStats単位(実数値/100=%)は390
    expect(result!.addend).toBeCloseTo(390);
  });

  it('applies the self-boosting rate for フロストメイジ霜天型 (ユーザー実測例: 器用さ6%→氷属性ボーナス1.41%)', () => {
    const result = calculateMasteryElementBonus('frostMage', 'type2', 6);

    expect(result).not.toBeNull();
    expect(result!.statId).toBe('iceBonus');
    // 6 * (0.2 * (1 + 6*3/100)) = 1.416% → floor後1.41%
    const displayedPercent = truncate2(result!.addend / 100);
    expect(displayedPercent).toBeCloseTo(1.41);
  });

  it('applies the self-boosting rate for ゲイルランサー烈風型', () => {
    const result = calculateMasteryElementBonus('galeLancer', 'type1', 10);

    expect(result).not.toBeNull();
    expect(result!.statId).toBe('windBonus');
    // 10 * (0.35 * (1 + 10*3/100)) = 4.55%
    expect(result!.addend / 100).toBeCloseTo(4.55);
  });
});
