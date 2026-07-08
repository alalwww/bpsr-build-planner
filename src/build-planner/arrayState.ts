import type { Dispatch, SetStateAction } from 'react';

// 配列state更新の共通パターン(clone→index更新→返す/swap)をまとめたヘルパー。

export function withIndex<T>(arr: readonly T[], index: number, value: T): T[] {
  const next = [...arr];
  next[index] = value;
  return next;
}

export function setAtIndex<T>(
  setState: Dispatch<SetStateAction<T[]>>,
  index: number,
  value: T,
): void {
  setState((prev) => withIndex(prev, index, value));
}

export function swapAtIndex<T>(arr: readonly T[], i: number, j: number): T[] {
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
