import { describe, expect, it } from 'vitest';
import type { EquipmentItem } from '../types';
import { isCandidateGsMatch } from './equipmentSlotPickerData';

function itemWithGs(equipGs: number): EquipmentItem {
  return {
    id: 1,
    slot: 'head',
    part: 201,
    equipGs,
    quality: 4,
    icon: '',
    baseStats: [],
    evo: [],
    reforgeMaxPerfectline: 0,
    reforgeEvoMin: 0,
    reforgeEvoMax: 0,
    reforgeEvoFvMin: 0,
    reforgeEvoFvMax: 0,
    fixedEvolutionStats: {},
  };
}

describe('isCandidateGsMatch', () => {
  it("'lv220' matches [220, 240)", () => {
    expect(isCandidateGsMatch(itemWithGs(219), 'lv220')).toBe(false);
    expect(isCandidateGsMatch(itemWithGs(220), 'lv220')).toBe(true);
    expect(isCandidateGsMatch(itemWithGs(239), 'lv220')).toBe(true);
    expect(isCandidateGsMatch(itemWithGs(240), 'lv220')).toBe(false);
  });

  it("'lv240' matches [240, 260)", () => {
    expect(isCandidateGsMatch(itemWithGs(239), 'lv240')).toBe(false);
    expect(isCandidateGsMatch(itemWithGs(240), 'lv240')).toBe(true);
    expect(isCandidateGsMatch(itemWithGs(259), 'lv240')).toBe(true);
    expect(isCandidateGsMatch(itemWithGs(260), 'lv240')).toBe(false);
  });

  it("'lv260' matches [260, +inf)", () => {
    expect(isCandidateGsMatch(itemWithGs(259), 'lv260')).toBe(false);
    expect(isCandidateGsMatch(itemWithGs(260), 'lv260')).toBe(true);
    expect(isCandidateGsMatch(itemWithGs(280), 'lv260')).toBe(true);
  });
});
