import { describe, expect, it, vi } from 'vitest';
import { memoize1 } from './memoize';

describe('memoize1', () => {
  it('caches the result while arguments are reference-equal', () => {
    const fn = vi.fn((a: number, b: number) => a + b);
    const memoized = memoize1(fn);

    expect(memoized(1, 2)).toBe(3);
    expect(memoized(1, 2)).toBe(3);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('recomputes when any argument reference changes', () => {
    const fn = vi.fn((obj: { x: number }) => obj.x * 2);
    const memoized = memoize1(fn);
    const a = { x: 1 };
    const b = { x: 1 };

    expect(memoized(a)).toBe(2);
    expect(memoized(b)).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('treats NaN consistently via Object.is', () => {
    const fn = vi.fn((v: number) => v);
    const memoized = memoize1(fn);

    expect(memoized(NaN)).toBeNaN();
    expect(memoized(NaN)).toBeNaN();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
