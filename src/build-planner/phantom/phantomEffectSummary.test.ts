import { describe, expect, it } from 'vitest';
import type { PhantomFactorSlotValue } from './phantomData';
import { computePhantomEffectTotals } from './phantomEffectSummary';
import type { GameDataT } from './phantomView';

// 表示文言は検証しないため、キーをそのまま返すスタブで十分。
const tg = ((key: string) => key) as unknown as GameDataT;

// template 9: 因子ノード 250(lv5、因子 4001 = ストームブレイド専用)と 251(lv15、因子 4127)。
// phantomLevel 20 は精錬ノード 1815(lv30)の手前。
const totals = (slots: Record<number, PhantomFactorSlotValue | null>) =>
  computePhantomEffectTotals(tg, 9, 20, {}, slots, 1, '映痕の効果');

describe('効果一覧の映痕', () => {
  it('ステータス系の映痕を合計に加え、重複不可は全因子で最大値1つ、速度とクラス映痕は個別効果', () => {
    const result = totals({
      250: {
        classKey: '4001',
        grade: 3,
        affixes: [
          { group: 1, quality: 2, value: 567 }, // 会心 +567
          { group: 6, quality: 2, value: 283 }, // 極性(会心値+%、器用さ-6%)
          { group: 101, quality: 2, value: 139 }, // クラス映痕
        ],
      },
      251: {
        classKey: '4127',
        grade: 1,
        affixes: [
          { group: 6, quality: 3, value: 467 }, // 同じ極性(こちらが最大)
          { group: 17, quality: 2, value: 71 }, // 攻撃速度(G1の2番目はクラス用スロットのため対象外)
        ],
      },
    });
    const delta = (statId: string) => result.statDeltas.find((d) => d.statId === statId);
    expect(delta('crit')).toMatchObject({ flat: 567, pct: 467 });
    expect(delta('mastery')).toMatchObject({ pct: -600 });
    const keys = result.individualEffects.map((e) => e.key);
    expect(keys).toContain('factor-250-affix-101');
    expect(keys.some((k) => k.startsWith('affix-speed-'))).toBe(false);
  });

  it('攻撃速度の映痕は個別効果として表示する', () => {
    const result = totals({
      250: {
        classKey: '4001',
        grade: 3,
        affixes: [{ group: 17, quality: 2, value: 71 }],
      },
    });
    const speed = result.individualEffects.find((e) => e.key === 'affix-speed-11722');
    expect(speed?.name).toBe('映痕の効果');
  });
});
