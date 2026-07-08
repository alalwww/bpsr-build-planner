import { describe, expect, it } from 'vitest';
import type { ModuleSlots } from '../types';
import { calcModuleEffectLevels } from './gameData';

// 手書きの最小effectsテーブル: [fightValue, totalLinkThreshold, effectsArray]
// level0=baseline(fv0,threshold0), level1(fv10,threshold2), level2(fv20,threshold5), level3(fv30,threshold9)
const EFFECTS = {
  '100': {
    icon: '',
    levels: [
      [0, 0, []],
      [10, 2, []],
      [20, 5, []],
      [30, 9, []],
    ] as [number, number, number[][]][],
  },
};

describe('calcModuleEffectLevels', () => {
  it('selects the highest level whose threshold is <= totalLink', () => {
    const slots: ModuleSlots = [
      { modId: 1, holes: [{ effectId: 100, linkCount: 5 }] },
      null,
      null,
      null,
      null,
    ];

    expect(calcModuleEffectLevels(slots, EFFECTS)).toEqual([
      { effectId: 100, level: 2, totalLink: 5 },
    ]);
  });

  it('returns level 0 when totalLink is below every level threshold', () => {
    const slots: ModuleSlots = [
      { modId: 1, holes: [{ effectId: 100, linkCount: 1 }] },
      null,
      null,
      null,
      null,
    ];

    expect(calcModuleEffectLevels(slots, EFFECTS)).toEqual([
      { effectId: 100, level: 0, totalLink: 1 },
    ]);
  });

  it('skips effectIds not present in the effects table', () => {
    const slots: ModuleSlots = [
      { modId: 1, holes: [{ effectId: 999, linkCount: 5 }] },
      null,
      null,
      null,
      null,
    ];

    expect(calcModuleEffectLevels(slots, EFFECTS)).toEqual([]);
  });

  it('sums linkCount across multiple holes/slots for the same effectId', () => {
    const slots: ModuleSlots = [
      { modId: 1, holes: [{ effectId: 100, linkCount: 3 }] },
      { modId: 2, holes: [{ effectId: 100, linkCount: 4 }] },
      null,
      null,
      null,
    ];

    expect(calcModuleEffectLevels(slots, EFFECTS)).toEqual([
      { effectId: 100, level: 2, totalLink: 7 },
    ]);
  });
});
