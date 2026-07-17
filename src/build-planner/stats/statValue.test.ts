import { describe, expect, it } from 'vitest';
import { calcStatValue, truncate1, truncate1Str } from './statValue';

describe('calcStatValue', () => {
  it('linearly interpolates between min and max without rounding', () => {
    // 50パーセントの完成度は50パーセンタイル値そのもの(端数保持)。
    expect(calcStatValue(100, 201, 50)).toBeCloseTo(150.5, 10);
  });

  it('does not floor away the fractional part (regression: values were prematurely truncated per item)', () => {
    // floor()していた旧実装ではここが45になっていた。
    expect(calcStatValue(0, 45.9, 100)).toBeCloseTo(45.9, 10);
  });

  it('returns exact min/max at the boundaries', () => {
    expect(calcStatValue(10, 20, 0)).toBe(10);
    expect(calcStatValue(10, 20, 100)).toBe(20);
  });
});

describe('truncate1', () => {
  it('truncates (does not round) to 1 decimal place', () => {
    expect(truncate1(45.99)).toBe(45.9);
    expect(truncate1(45.94)).toBe(45.9);
    expect(truncate1(45.95)).toBe(45.9);
  });

  it('absorbs floating point representation error before truncating', () => {
    // 45.9999999999996 のような浮動小数点誤差が乗っていても 46.0 として扱う。
    expect(truncate1(0.1 + 0.2)).toBe(0.3);
    expect(truncate1(46 - 6e-15)).toBe(46);
  });
});

describe('truncate1Str', () => {
  it('always shows exactly 1 decimal digit', () => {
    expect(truncate1Str(46)).toBe('46.0');
    expect(truncate1Str(45.94)).toBe('45.9');
  });
});
