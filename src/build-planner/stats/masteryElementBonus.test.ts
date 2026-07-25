import { describe, expect, it } from 'vitest';
import { truncate2 } from '../character/statFormat';
import { calculateMasteryStatEffects } from './masteryElementBonus';

describe('calculateMasteryStatEffects', () => {
  it('returns no effects for a class/type with no mastery conversion', () => {
    expect(calculateMasteryStatEffects('shieldFighter', 'type1', 6)).toEqual([]);
  });

  it('returns no effects when mastery is 0', () => {
    expect(calculateMasteryStatEffects('frostMage', 'type1', 0)).toEqual([]);
  });

  it('applies the flat rate for フロストメイジ氷牙型 (0.65%/pt, no rate boost)', () => {
    const [result] = calculateMasteryStatEffects('frostMage', 'type1', 6);

    expect(result.statId).toBe('iceBonus');
    // 6% * 0.65 = 3.9% → rawStats単位(実数値/100=%)は390
    expect(result.addend).toBeCloseTo(390);
  });

  it('applies the self-boosting rate for フロストメイジ霜天型 (ユーザー実測例: 器用さ6%→氷属性ボーナス1.41%)', () => {
    const [result] = calculateMasteryStatEffects('frostMage', 'type2', 6);

    expect(result.statId).toBe('iceBonus');
    // 6 * (0.2 * (1 + 6*3/100)) = 1.416% → floor後1.41%
    const displayedPercent = truncate2(result.addend / 100);
    expect(displayedPercent).toBeCloseTo(1.41);
  });

  it('applies the self-boosting rate for ゲイルランサー烈風型', () => {
    const [result] = calculateMasteryStatEffects('galeLancer', 'type1', 10);

    expect(result.statId).toBe('windBonus');
    // 10 * (0.35 * (1 + 10*3/100)) = 4.55%
    expect(result.addend / 100).toBeCloseTo(4.55);
  });

  it('returns multiple effects for ヴァーダントオラクル威咲型 (森属性ボーナス + バリア強度)', () => {
    const results = calculateMasteryStatEffects('verdantOracle', 'type1', 10);

    expect(results).toHaveLength(2);
    const forest = results.find((r) => r.statId === 'forestBonus');
    const barrier = results.find((r) => r.statId === 'barrierStrength');
    // 10% * 0.75 = 7.5%
    expect(forest!.addend / 100).toBeCloseTo(7.5);
    // 10% * 0.3 = 3%
    expect(barrier!.addend / 100).toBeCloseTo(3);
  });

  it('applies healingPower for ヴァーダントオラクル森癒型 (1%/pt)', () => {
    const [result] = calculateMasteryStatEffects('verdantOracle', 'type2', 10);

    expect(result.statId).toBe('healingPower');
    expect(result.addend / 100).toBeCloseTo(10);
  });

  it('applies barrierStrength for ヘヴィガーディアン剛身型 (2.5%/pt)', () => {
    const [result] = calculateMasteryStatEffects('heavyGuardian', 'type1', 6);

    expect(result.statId).toBe('barrierStrength');
    expect(result.addend / 100).toBeCloseTo(15);
  });

  it('returns no effects for ヘヴィガーディアン剛守型 (レジストダメージ軽減は未実装)', () => {
    expect(calculateMasteryStatEffects('heavyGuardian', 'type2', 6)).toEqual([]);
  });
});
