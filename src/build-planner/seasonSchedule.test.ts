import { describe, expect, it } from 'vitest';
import { getDefaultPhantomLevel, getGsScheduleTier } from './seasonSchedule';

const jst = (s: string) => new Date(`${s}+09:00`);

describe('getGsScheduleTier', () => {
  it('switches tiers at 05:00 JST on the release dates', () => {
    expect(getGsScheduleTier(jst('2026-11-23T00:00:00'))).toBe('lv320');
    expect(getGsScheduleTier(jst('2026-12-14T04:59:59'))).toBe('lv320');
    expect(getGsScheduleTier(jst('2026-12-14T05:00:00'))).toBe('lv340');
    expect(getGsScheduleTier(jst('2027-01-25T04:59:59'))).toBe('lv340');
    expect(getGsScheduleTier(jst('2027-01-25T05:00:00'))).toBe('lv360');
    expect(getGsScheduleTier(jst('2030-01-01T00:00:00'))).toBe('lv360');
  });
});

describe('getDefaultPhantomLevel', () => {
  it('raises the default level at 05:00 JST on each step date', () => {
    expect(getDefaultPhantomLevel(jst('2026-11-23T00:00:00'))).toBe(30);
    expect(getDefaultPhantomLevel(jst('2026-12-07T04:59:59'))).toBe(30);
    expect(getDefaultPhantomLevel(jst('2026-12-07T05:00:00'))).toBe(65);
    expect(getDefaultPhantomLevel(jst('2026-12-28T05:00:00'))).toBe(80);
    expect(getDefaultPhantomLevel(jst('2027-01-11T05:00:00'))).toBe(90);
    expect(getDefaultPhantomLevel(jst('2027-02-01T04:59:59'))).toBe(90);
    expect(getDefaultPhantomLevel(jst('2027-02-01T05:00:00'))).toBe(100);
    expect(getDefaultPhantomLevel(jst('2030-01-01T00:00:00'))).toBe(100);
  });
});
