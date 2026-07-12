import { describe, expect, it, vi } from 'vitest';
import { memoize1, memoizeByKeys } from './memoize';

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

describe('memoizeByKeys', () => {
  it('新規オブジェクトでも各キーの値が同じならキャッシュを返す', () => {
    const shared = { deep: true };
    const fn = vi.fn((input: { a: number; b: object }) => ({ sum: input.a, ref: input.b }));
    const memoized = memoizeByKeys(fn);

    const first = memoized({ a: 1, b: shared });
    const second = memoized({ a: 1, b: shared });
    expect(second).toBe(first);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('いずれかの値が変わると再計算する', () => {
    const shared = { deep: true };
    const fn = vi.fn((input: { a: number; b: object }) => input.a);
    const memoized = memoizeByKeys(fn);

    memoized({ a: 1, b: shared });
    memoized({ a: 2, b: shared });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('値の中身が同じでも参照が変わると再計算する(shallow比較)', () => {
    const fn = vi.fn((input: { b: object }) => input.b);
    const memoized = memoizeByKeys(fn);

    memoized({ b: { deep: true } });
    memoized({ b: { deep: true } });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('キー集合が変わると再計算する', () => {
    const fn = vi.fn((input: Record<string, number>) => Object.keys(input).length);
    const memoized = memoizeByKeys(fn);

    expect(memoized({ a: 1 })).toBe(1);
    expect(memoized({ a: 1, b: 2 })).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
