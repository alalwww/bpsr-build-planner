import { describe, expect, it } from 'vitest';
import {
  buildTreeSteps,
  getActivePhantomNodeIds,
  getDefaultFactorGrade,
  getUnlockLevel,
  hasLegacyPhantomData,
  isTemplateLegacy,
  stData,
} from './phantomData';

// これらは実データ(src/data/season-talents.json)に対する性格づけ(characterization)テスト。
// stData.templates/treeNodes をクローズオーバーしているため合成フィクスチャに差し替えられず、
// リファクタリング前に現状の出力をロックする目的で意図的に実データを使う。
// テンプレート9(S4祈願心相晶「幻滅の崩界」、sortId=1)はノード数21で、S4の特徴(4択/3択の
// 末端ノード群、因子スロットの2択、2ノード→1ノードの合流)を一通り含む。
const TEMPLATE_ID = 9;
const ROOT_ID = stData.templates[String(TEMPLATE_ID)].rootNodeId; // 1801

describe('buildTreeSteps', () => {
  it('walks template 9 into the expected ordered steps', () => {
    expect(buildTreeSteps(ROOT_ID, TEMPLATE_ID)).toEqual([
      { kind: 'fixed-ordinary', nodeIds: [1801], sameGroupId: 0 },
      { kind: 'solo-factor', nodeIds: [250], sameGroupId: 0 },
      { kind: 'choice-ordinary', nodeIds: [1802, 1803, 1804, 1805], sameGroupId: 1802 },
      { kind: 'solo-factor', nodeIds: [251], sameGroupId: 0 },
      { kind: 'choice-ordinary', nodeIds: [1806, 1807, 1808], sameGroupId: 1806 },
      { kind: 'fixed-ordinary', nodeIds: [1815], sameGroupId: 0 },
      { kind: 'solo-factor', nodeIds: [252], sameGroupId: 0 },
      { kind: 'choice-factor-type', nodeIds: [253, 254], sameGroupId: 253 },
      { kind: 'choice-ordinary', nodeIds: [1809, 1810, 1811], sameGroupId: 1809 },
      { kind: 'solo-factor', nodeIds: [255], sameGroupId: 0 },
      { kind: 'choice-ordinary', nodeIds: [1812, 1813], sameGroupId: 1812 },
      { kind: 'fixed-ordinary', nodeIds: [1814], sameGroupId: 0 },
    ]);
  });
});

describe('getActivePhantomNodeIds', () => {
  it('activates only the non-choice main path when no choice-group selections are made', () => {
    // 1801 → 250 → 251 → 1815 → 252 は選択不要の一本道。255は252の子だが、
    // 選択グループ(1809等)を経由しない直接の子のため同様に有効になる。
    const active = getActivePhantomNodeIds(ROOT_ID, TEMPLATE_ID, {});
    expect([...active].sort((a, b) => a - b)).toEqual([250, 251, 252, 255, 1801, 1815]);
  });

  it('walks the full choice path down to the merge node when every choice-group is selected', () => {
    const selections = { 1802: 1803, 1806: 1808, 253: 254, 1809: 1811, 1812: 1813 };
    const active = getActivePhantomNodeIds(ROOT_ID, TEMPLATE_ID, selections);

    expect([...active].sort((a, b) => a - b)).toEqual([
      250, 251, 252, 254, 255, 1801, 1803, 1808, 1811, 1813, 1814, 1815,
    ]);
    // 選ばなかった側は含まれない
    for (const unchosen of [1802, 1804, 1805, 1806, 1807, 253, 1809, 1810, 1812]) {
      expect(active.has(unchosen)).toBe(false);
    }
  });
});

describe('getUnlockLevel', () => {
  it('reads the required level from the [[93, 4, N]] condition format (root node 1801, factor node 250)', () => {
    expect(getUnlockLevel(stData.treeNodes['1801'].unlockCondition)).toBe(0);
    expect(getUnlockLevel(stData.treeNodes['250'].unlockCondition)).toBe(5);
  });

  it('returns 0 (always unlocked) for an empty unlockCondition', () => {
    expect(getUnlockLevel([])).toBe(0);
  });
});

describe('hasLegacyPhantomData / isTemplateLegacy', () => {
  it('treats an S3 (潜在心相晶) template id as legacy and an S4 one as current', () => {
    expect(isTemplateLegacy(1)).toBe(true);
    expect(isTemplateLegacy(TEMPLATE_ID)).toBe(false);
    expect(isTemplateLegacy(null)).toBe(false);
  });

  it('detects a legacy template or a legacy (absent from current data) factor class', () => {
    expect(hasLegacyPhantomData({ phantomTemplateId: 1 })).toBe(true);
    expect(
      hasLegacyPhantomData({
        phantomTemplateId: TEMPLATE_ID,
        phantomFactorSlots: { 250: { classKey: '202201', grade: 1 } },
      }),
    ).toBe(true);
    expect(
      hasLegacyPhantomData({
        phantomTemplateId: TEMPLATE_ID,
        phantomFactorSlots: { 250: { classKey: '4001', grade: 1 }, 251: null },
      }),
    ).toBe(false);
    expect(hasLegacyPhantomData(null)).toBe(false);
  });
});

describe('getDefaultFactorGrade', () => {
  it('is fixed at G2 (not linked to the season schedule)', () => {
    expect(getDefaultFactorGrade()).toBe(2);
  });
});
