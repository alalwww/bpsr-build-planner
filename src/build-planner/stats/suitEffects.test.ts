import { describe, expect, it } from 'vitest';
import { PROFESSIONS } from '../profession';
import type { EquipmentItem, EquippedItems } from '../types';
import { calculateSuitAtkSpeedBonus } from './suitEffects';

function suitItem(suitId: number): EquipmentItem {
  return { suitId } as EquipmentItem;
}

describe('calculateSuitAtkSpeedBonus', () => {
  it('returns 0 when no suit pieces are equipped', () => {
    const bonus = calculateSuitAtkSpeedBonus({}, PROFESSIONS.stormBlade, 'type2', 50);
    expect(bonus).toBe(0);
  });

  it('returns 0 when the suit is equipped below the tier limitNum (S2 needs 2 pieces)', () => {
    const equipped: EquippedItems = { weapon: suitItem(101) };
    const bonus = calculateSuitAtkSpeedBonus(equipped, PROFESSIONS.stormBlade, 'type2', 50);
    expect(bonus).toBe(0);
  });

  it('applies +6% atk speed for the S2 2-set (stormBlade 月影型, school 102) when atk speed is below 80%', () => {
    const equipped: EquippedItems = { weapon: suitItem(101), head: suitItem(101) };
    const bonus = calculateSuitAtkSpeedBonus(equipped, PROFESSIONS.stormBlade, 'type2', 79.99);
    expect(bonus).toBe(6);
  });

  it('applies no bonus once atk speed reaches 80% (the >=80% branch grants an unmodeled skill damage bonus instead)', () => {
    const equipped: EquippedItems = { weapon: suitItem(101), head: suitItem(101) };
    const bonus = calculateSuitAtkSpeedBonus(equipped, PROFESSIONS.stormBlade, 'type2', 80);
    expect(bonus).toBe(0);
  });

  it('does not apply to stormBlade type1 (school 101), whose S2 2-set buffId is a different, unmodeled effect', () => {
    const equipped: EquippedItems = { weapon: suitItem(101), head: suitItem(101) };
    const bonus = calculateSuitAtkSpeedBonus(equipped, PROFESSIONS.stormBlade, 'type1', 50);
    expect(bonus).toBe(0);
  });

  it('does not apply to other professions unrelated buffIds', () => {
    const equipped: EquippedItems = { weapon: suitItem(101), head: suitItem(101) };
    const bonus = calculateSuitAtkSpeedBonus(equipped, PROFESSIONS.frostMage, 'type1', 50);
    expect(bonus).toBe(0);
  });
});
