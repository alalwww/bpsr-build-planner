import { describe, expect, it } from 'vitest';
import gameDataJa from '../../locales/ja_JP/game-data.json';
import gameDataZh from '../../locales/zh_CN/game-data.json';
import { pfData, stData } from './phantomData';
import {
  factorClassName,
  factorShortName,
  getFactorBaseOptions,
  type GameDataT,
} from './phantomView';

// game-data のキー(ドット区切り)を引く最小の翻訳関数。
function makeTg(data: unknown): GameDataT {
  return ((key: string, opts?: { defaultValue?: string }) => {
    let v: unknown = data;
    for (const k of key.split('.')) v = (v as Record<string, unknown> | undefined)?.[k];
    return typeof v === 'string' ? v : (opts?.defaultValue ?? key);
  }) as unknown as GameDataT;
}
const tgJa = makeTg(gameDataJa);
const tgZh = makeTg(gameDataZh);

describe('因子の短縮名', () => {
  it('removes the class name part and the level suffix', () => {
    expect(factorShortName(tgJa, '4001')).toBe('想像因子X1');
    expect(factorShortName(tgJa, '4121')).toBe('特異因子X1');
    // 中国語はクラスの正式名(灵魂乐手)と異なる略称(灵魂)が付く
    expect(factorShortName(tgZh, '4121')).toBe('奇点因子X1');
    expect(factorClassName(tgJa, '4121')).toBe('ビートパフォーマー');
  });

  it('keeps common factors as is', () => {
    const common = Object.entries(pfData.byClass).find(
      ([, fc]) => fc.seasonId === 4 && fc.professionIds.length === 0,
    )!;
    expect(factorShortName(tgJa, common[0])).toMatch(/因子X\d+$/);
    expect(factorClassName(tgJa, common[0])).toBeNull();
  });

  it('groups dropdown options by class without interleaving', () => {
    for (const groupId of Object.keys(stData.intermediateSlots).map(Number)) {
      const groups = getFactorBaseOptions(tgJa, groupId, 1, '無制限').map((o) => o.group);
      const seen = new Set<string | undefined>();
      groups.forEach((g, i) => {
        if (i > 0 && g !== groups[i - 1]) expect(seen.has(g)).toBe(false);
        seen.add(g);
      });
    }
  });
});
