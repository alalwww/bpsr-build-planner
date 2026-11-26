import { describe, expect, it } from 'vitest';
import { addPreset, deletePreset, overwritePreset, renamePreset } from './presetStorage';

interface TestPreset {
  id: string;
  name: string;
  value: number;
}

describe('presetStorage の一覧操作', () => {
  it('追加したプリセットは先頭に入り、id が振られる', () => {
    const existing: TestPreset[] = [{ id: 'a', name: 'A', value: 1 }];
    const { presets, added } = addPreset<TestPreset>(existing, 'B', { value: 2 });
    expect(presets).toEqual([added, existing[0]]);
    expect(added).toMatchObject({ name: 'B', value: 2 });
    expect(added.id).toBeTruthy();
  });

  it('上書き・リネーム・削除は対象の id のみ変更する', () => {
    const presets: TestPreset[] = [
      { id: 'a', name: 'A', value: 1 },
      { id: 'b', name: 'B', value: 2 },
    ];
    expect(overwritePreset(presets, 'b', 'B2', { value: 3 })).toEqual([
      presets[0],
      { id: 'b', name: 'B2', value: 3 },
    ]);
    expect(renamePreset(presets, 'a', 'A2')).toEqual([
      { id: 'a', name: 'A2', value: 1 },
      presets[1],
    ]);
    expect(deletePreset(presets, 'a')).toEqual([presets[1]]);
  });
});
