import { describe, expect, it } from 'vitest';
import { affixPresetContentOf, affixPresetMatches, applyAffixPreset } from './affixPresets';

// 会心(ステータス、group 1) / ストームブレイド「幸運の一撃」(クラス、group 101)
const CRIT = { group: 1, quality: 2, value: 567 };
const SB_CLASS = { group: 101, quality: 2, value: 139 };
// 因子 4001: G1 [[1],[2]] / G2 [[1],[2],[1,2]] / G3 [[1],[1],[2],[2]]

describe('映痕プリセット', () => {
  it('保存内容は因子レベルと、そのレベルのスロット数ぶんの映痕(空きは null)', () => {
    expect(affixPresetContentOf({ classKey: '4001', grade: 3, affixes: [CRIT] })).toEqual({
      grade: 3,
      affixes: [CRIT, null, null, null],
    });
    expect(affixPresetContentOf({ classKey: '4001', grade: 1 })).toEqual({
      grade: 1,
      affixes: [null, null],
    });
  });

  it('内容の一致判定は末尾の空きスロットの有無に左右されない', () => {
    const preset = { grade: 2, affixes: [CRIT, SB_CLASS, null] };
    expect(
      affixPresetMatches(preset, { classKey: '4001', grade: 2, affixes: [CRIT, SB_CLASS] }),
    ).toBe(true);
    expect(
      affixPresetMatches(preset, { classKey: '4001', grade: 3, affixes: [CRIT, SB_CLASS] }),
    ).toBe(false);
    expect(
      affixPresetMatches(preset, {
        classKey: '4001',
        grade: 2,
        affixes: [{ ...CRIT, value: 300 }, SB_CLASS],
      }),
    ).toBe(false);
  });

  it('ロード時は因子の種類を保ったまま、因子レベルと映痕を復元する', () => {
    expect(
      applyAffixPreset(
        { classKey: '4001', grade: 1, affixes: [CRIT] },
        { grade: 3, affixes: [CRIT, CRIT, SB_CLASS, null] },
      ),
    ).toEqual({ classKey: '4001', grade: 3, affixes: [CRIT, CRIT, SB_CLASS] });
  });
});
