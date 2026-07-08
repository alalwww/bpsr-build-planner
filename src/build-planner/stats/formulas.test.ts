import { describe, expect, it } from 'vitest';
import { diminishingPercent } from './formulas';

describe('diminishingPercent', () => {
  it('returns basePercent unchanged when real is zero', () => {
    expect(diminishingPercent(0, 100, 10)).toBe(10);
  });

  it('returns basePercent unchanged when real is negative', () => {
    expect(diminishingPercent(-5, 100, 10)).toBe(10);
  });

  it('defaults basePercent to 0 when omitted', () => {
    expect(diminishingPercent(0, 100)).toBe(0);
  });

  it('applies the diminishing-returns curve for positive real values', () => {
    // basePercent + 100 * real / (real + k)
    expect(diminishingPercent(100, 100)).toBe(50);
    expect(diminishingPercent(100, 100, 5)).toBe(55);
  });

  it('approaches 100 + basePercent as real grows large relative to k', () => {
    expect(diminishingPercent(1_000_000, 100)).toBeCloseTo(100, 1);
  });
});
