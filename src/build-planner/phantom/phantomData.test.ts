import { describe, expect, it } from 'vitest';
import { buildTreeSteps, getActivePhantomNodeIds, stData } from './phantomData';

// これらは実データ(src/data/season-talents.json)に対する性格づけ(characterization)テスト。
// stData.templates/treeNodes をクローズオーバーしているため合成フィクスチャに差し替えられず、
// リファクタリング前に現状の出力をロックする目的で意図的に実データを使う。
// テンプレート1(sortId=5)はノード数20と小さく、目視で追える。
const TEMPLATE_ID = 1;
const ROOT_ID = stData.templates[String(TEMPLATE_ID)].rootNodeId; // 1001

describe('buildTreeSteps', () => {
  it('walks template 1 into the expected ordered steps', () => {
    expect(buildTreeSteps(ROOT_ID, TEMPLATE_ID)).toEqual([
      { kind: 'fixed-ordinary', nodeIds: [1001], sameGroupId: 0 },
      { kind: 'choice-ordinary', nodeIds: [1002, 1003], sameGroupId: 1002 },
      { kind: 'solo-factor', nodeIds: [100], sameGroupId: 0 },
      { kind: 'solo-factor', nodeIds: [103], sameGroupId: 0 },
      { kind: 'solo-factor', nodeIds: [106], sameGroupId: 0 },
      { kind: 'choice-ordinary', nodeIds: [1004, 1005], sameGroupId: 1005 },
      { kind: 'solo-factor', nodeIds: [216], sameGroupId: 0 },
      { kind: 'solo-factor', nodeIds: [101], sameGroupId: 0 },
      { kind: 'choice-factor-type', nodeIds: [104, 109], sameGroupId: 109 },
      { kind: 'solo-factor', nodeIds: [107], sameGroupId: 0 },
      { kind: 'choice-ordinary', nodeIds: [1006, 1007], sameGroupId: 1007 },
      { kind: 'path-factor', nodeIds: [108, 102], sameGroupId: 102 },
      { kind: 'solo-factor', nodeIds: [105], sameGroupId: 0 },
      { kind: 'choice-ordinary', nodeIds: [1008, 1009], sameGroupId: 1009 },
      { kind: 'solo-factor', nodeIds: [217], sameGroupId: 0 },
      { kind: 'fixed-ordinary', nodeIds: [1010], sameGroupId: 0 },
    ]);
  });
});

describe('getActivePhantomNodeIds', () => {
  it('activates only the root when no choice-group selections are made', () => {
    const active = getActivePhantomNodeIds(ROOT_ID, TEMPLATE_ID, {});
    expect([...active].sort((a, b) => a - b)).toEqual([1001]);
  });

  it('walks the full choice path down to a terminal node when every choice-group is selected', () => {
    // 1002(choice-ordinary)→1002, 1005(choice-ordinary)→1004, 109(choice-factor-type)→104,
    // 1007(choice-ordinary)→1007, 1009(choice-ordinary)→1008 を選択。
    // path-factor(102/108)は選択不要で、1007側が有効化されたことで自動的に102側が有効になる。
    const selections = { 1002: 1002, 1005: 1004, 109: 104, 1007: 1007, 1009: 1008 };
    const active = getActivePhantomNodeIds(ROOT_ID, TEMPLATE_ID, selections);

    expect([...active].sort((a, b) => a - b)).toEqual([
      100, 101, 102, 103, 104, 105, 106, 107, 216, 217, 1001, 1002, 1004, 1007, 1008, 1010,
    ]);
    // 選ばなかった側(1003/1005/109/1006/108/1009)は含まれない
    for (const unchosen of [1003, 1005, 109, 1006, 108, 1009]) {
      expect(active.has(unchosen)).toBe(false);
    }
  });
});
