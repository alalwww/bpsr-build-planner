import { describe, expect, it } from 'vitest';
import { getGsScheduleTier } from './seasonSchedule';

describe('getGsScheduleTier', () => {
  it("returns 'lv220' before 2026-08-10T05:00:00+09:00", () => {
    expect(getGsScheduleTier(new Date('2026-01-01T00:00:00+09:00'))).toBe('lv220');
    expect(getGsScheduleTier(new Date('2026-08-10T04:59:59+09:00'))).toBe('lv220');
  });

  it("returns 'lv240' from 2026-08-10T05:00:00+09:00 (inclusive) until before 2026-09-21T05:00:00+09:00", () => {
    expect(getGsScheduleTier(new Date('2026-08-10T05:00:00+09:00'))).toBe('lv240');
    expect(getGsScheduleTier(new Date('2026-09-01T00:00:00+09:00'))).toBe('lv240');
    expect(getGsScheduleTier(new Date('2026-09-21T04:59:59+09:00'))).toBe('lv240');
  });

  it("returns 'lv260' from 2026-09-21T05:00:00+09:00 (inclusive) onward", () => {
    expect(getGsScheduleTier(new Date('2026-09-21T05:00:00+09:00'))).toBe('lv260');
    expect(getGsScheduleTier(new Date('2030-01-01T00:00:00+09:00'))).toBe('lv260');
  });
});
