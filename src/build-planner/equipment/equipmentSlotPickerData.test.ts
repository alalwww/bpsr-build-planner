import { describe, expect, it } from 'vitest';
import type { EquipmentItem } from '../types';
import {
  getDefaultCandidateGsFilter,
  getItemNameColor,
  isCandidateGsMatch,
  isSeaBreezeSeries,
} from './equipmentSlotPickerData';

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
  it("'lv320' matches [320, 340)", () => {
    expect(isCandidateGsMatch(itemWithGs(319), 'lv320')).toBe(false);
    expect(isCandidateGsMatch(itemWithGs(320), 'lv320')).toBe(true);
    expect(isCandidateGsMatch(itemWithGs(339), 'lv320')).toBe(true);
    expect(isCandidateGsMatch(itemWithGs(340), 'lv320')).toBe(false);
  });

  it("'lv340' matches [340, 360)", () => {
    expect(isCandidateGsMatch(itemWithGs(339), 'lv340')).toBe(false);
    expect(isCandidateGsMatch(itemWithGs(340), 'lv340')).toBe(true);
    expect(isCandidateGsMatch(itemWithGs(359), 'lv340')).toBe(true);
    expect(isCandidateGsMatch(itemWithGs(360), 'lv340')).toBe(false);
  });

  it("'lv360' matches [360, +inf)", () => {
    expect(isCandidateGsMatch(itemWithGs(359), 'lv360')).toBe(false);
    expect(isCandidateGsMatch(itemWithGs(360), 'lv360')).toBe(true);
    expect(isCandidateGsMatch(itemWithGs(380), 'lv360')).toBe(true);
  });
});

describe('getDefaultCandidateGsFilter', () => {
  // 境界の網羅的なテストは seasonSchedule.test.ts (getGsScheduleTier) 側で行う。
  // ここでは CandidateGsFilter への委譲が正しく繋がっていることだけ確認する。
  it('delegates to getGsScheduleTier (a pre-schedule date resolves to lv320)', () => {
    expect(getDefaultCandidateGsFilter(new Date('2026-01-01T00:00:00+09:00'))).toBe('lv320');
  });
});

describe('isSeaBreezeSeries', () => {
  const withIcon = (icon: string): EquipmentItem => ({ ...itemWithGs(320), quality: 5, icon });

  it('treats 蒼海 (06) and 暁光 (14) weapons as the same series', () => {
    expect(isSeaBreezeSeries(withIcon('ch_wp_olvera_06_01'))).toBe(true);
    expect(isSeaBreezeSeries(withIcon('ch_wp_olvera_14_01'))).toBe(true);
    expect(getItemNameColor(withIcon('ch_wp_tata_14_01'))).toBe('#5599dd');
  });

  it('does not match other weapons', () => {
    expect(isSeaBreezeSeries(withIcon('ch_wp_olvera_05_01'))).toBe(false);
  });
});
