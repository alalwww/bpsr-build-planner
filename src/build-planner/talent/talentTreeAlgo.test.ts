import { describe, expect, it } from 'vitest';
import type { TreeNode } from './talentTreeData';
import {
  bfsReachable,
  countCost,
  deselectNodeAndPrune,
  deselectR2NodeWithCascade,
  findEffectivePath,
} from './talentTreeAlgo';

// ---- 合成ツリーのヘルパー ----
// talentId は id と同値にし、コストは costs マップから注入する(実データ非依存)。

interface NodeSpec {
  pre?: number[];
  next?: number[];
  unlock?: number[][];
}

function buildTree(specs: Record<number, NodeSpec>): Map<number, TreeNode> {
  const map = new Map<number, TreeNode>();
  for (const [idStr, spec] of Object.entries(specs)) {
    const id = Number(idStr);
    map.set(id, {
      id,
      talentId: id,
      stage: 1,
      bdType: 0,
      preNodes: spec.pre ?? [],
      nextNodes: spec.next ?? [],
      position: [0, 0],
      unlock: spec.unlock,
    });
  }
  return map;
}

const costOf =
  (costs: Record<number, number>) =>
  (talentId: number): number =>
    costs[talentId] ?? 0;

describe('bfsReachable', () => {
  it('ルートが無効なら空集合を返す', () => {
    const nodes = buildTree({ 1: { next: [2] }, 2: { pre: [1] } });
    expect(bfsReachable(new Set([2]), nodes, 1).size).toBe(0);
  });

  it('有効ノードのみを辿って到達集合を返す', () => {
    const nodes = buildTree({
      1: { next: [2, 3] },
      2: { pre: [1], next: [4] },
      3: { pre: [1] },
      4: { pre: [2] },
    });
    // 2が無効なので4へは到達できない
    expect(bfsReachable(new Set([1, 3, 4]), nodes, 1)).toEqual(new Set([1, 3]));
  });
});

describe('countCost', () => {
  it('注入したコスト表で合計を計算する', () => {
    const nodes = buildTree({ 1: {}, 2: {}, 3: {} });
    const getCost = costOf({ 1: 1, 2: 2, 3: 4 });
    expect(countCost(new Set([1, 3]), nodes, getCost)).toBe(5);
  });
});

describe('deselectNodeAndPrune', () => {
  // 1(root) → 2 → 3 の直列ツリー
  const chain = buildTree({
    1: { next: [2] },
    2: { pre: [1], next: [3] },
    3: { pre: [2] },
  });

  it('中間ノードを外すと下流も到達不能として外れる', () => {
    expect(deselectNodeAndPrune(new Set([1, 2, 3]), 2, chain, 1)).toEqual(new Set([1]));
  });

  it('末端ノードを外しても上流は残る', () => {
    expect(deselectNodeAndPrune(new Set([1, 2, 3]), 3, chain, 1)).toEqual(new Set([1, 2]));
  });

  it('ルートを外すと全ノードが外れる', () => {
    expect(deselectNodeAndPrune(new Set([1, 2, 3]), 1, chain, 1).size).toBe(0);
  });

  it('ひし形パターンでは残った経路経由のノードは外れない', () => {
    // 1 → 2 → 4 / 1 → 3 → 4
    const diamond = buildTree({
      1: { next: [2, 3] },
      2: { pre: [1], next: [4] },
      3: { pre: [1], next: [4] },
      4: { pre: [2, 3] },
    });
    expect(deselectNodeAndPrune(new Set([1, 2, 3, 4]), 2, diamond, 1)).toEqual(new Set([1, 3, 4]));
  });
});

describe('deselectR2NodeWithCascade', () => {
  // 1(R2ルート) → 2(通常, cost10)
  // 1          → 3(unlock: 総ポイント>=45, cost5) → 4(cost5)
  const tree = buildTree({
    1: { next: [2, 3] },
    2: { pre: [1] },
    3: { pre: [1], next: [4], unlock: [[3, 45]] },
    4: { pre: [3] },
  });
  const getCost = costOf({ 1: 1, 2: 10, 3: 5, 4: 5 });

  it('総ポイント低下でアンロック条件が外れたノードとその子孫をカスケード除去する', () => {
    // R1=30 + {1,2,3,4}=21 → 51。2を外すと41 < 45 で3が失格、子孫4も到達不能で外れる
    const result = deselectR2NodeWithCascade(new Set([1, 2, 3, 4]), 2, tree, 1, 30, getCost);
    expect(result).toEqual(new Set([1]));
  });

  it('アンロック条件を満たしたままなら他ノードは外れない', () => {
    // R1=44 + {1,3,4}=11 → 55。2を外しても45 >= 45 で3は残る
    const result = deselectR2NodeWithCascade(new Set([1, 2, 3, 4]), 2, tree, 1, 44, getCost);
    expect(result).toEqual(new Set([1, 3, 4]));
  });

  it('兄弟B群同士がコストを補い合う誤判定をしない', () => {
    // 1(root) → 5(通常, cost10) / 1 → 6(unlock>=35, cost10) / 1 → 7(unlock>=35, cost10)
    const siblings = buildTree({
      1: { next: [5, 6, 7] },
      5: { pre: [1] },
      6: { pre: [1], unlock: [[3, 35]] },
      7: { pre: [1], unlock: [[3, 35]] },
    });
    const cost = costOf({ 1: 0, 5: 10, 6: 10, 7: 10 });
    // R1=30、5を外すとA群(root+通常ノード)=30 < 35。B群(6,7)の自コストは
    // 判定に含めないため両方失格になる(片方のコストでもう片方が延命しない)
    const result = deselectR2NodeWithCascade(new Set([1, 5, 6, 7]), 5, siblings, 1, 30, cost);
    expect(result).toEqual(new Set([1]));
  });

  it('R2ルート自身は unlock 条件があっても除去されない', () => {
    const rootLocked = buildTree({
      1: { next: [2], unlock: [[3, 999]] },
      2: { pre: [1] },
      3: { pre: [1] },
    });
    const cost = costOf({ 1: 1, 2: 5, 3: 5 });
    const result = deselectR2NodeWithCascade(new Set([1, 2]), 2, rootLocked, 1, 0, cost);
    expect(result).toEqual(new Set([1]));
  });
});

describe('findEffectivePath', () => {
  it('一本道なら未取得ノード列を返す', () => {
    const nodes = buildTree({
      1: { next: [2] },
      2: { pre: [1], next: [3] },
      3: { pre: [2] },
    });
    const path = findEffectivePath(3, new Set([1]), nodes, () => true);
    expect(path).toEqual([1, 2, 3]);
  });

  it('必要ノード集合が経路によって異なる場合は null を返す', () => {
    // 1 → 2 → 4 / 1 → 3 → 4 で 2,3 とも未取得: どちらを経由するか曖昧
    const diamond = buildTree({
      1: { next: [2, 3] },
      2: { pre: [1], next: [4] },
      3: { pre: [1], next: [4] },
      4: { pre: [2, 3] },
    });
    expect(findEffectivePath(4, new Set([1]), diamond, () => true)).toBeNull();
  });

  it('ひし形でも片側が取得済みなら残り一方のパスを返す', () => {
    const diamond = buildTree({
      1: { next: [2, 3] },
      2: { pre: [1], next: [4] },
      3: { pre: [1], next: [4] },
      4: { pre: [2, 3] },
    });
    expect(findEffectivePath(4, new Set([1, 2]), diamond, () => true)).toEqual([2, 4]);
  });

  it('中継ノードがアンロック条件を満たしていない場合、そこを経由する経路はnullになる', () => {
    // 1(root, 取得済み) → 2(未取得, アンロック未達) → 3(未取得)
    // 2自身のクリックはhandleNodeClick側で別途弾かれる想定のため、ここでは
    // 「2を経由しないと辿り着けない3」がisUnlockMet経由でブロックされることを確認する。
    const chain = buildTree({
      1: { next: [2] },
      2: { pre: [1], next: [3] },
      3: { pre: [2] },
    });
    const isUnlockMet = (n: TreeNode) => n.id !== 2;
    expect(findEffectivePath(3, new Set([1]), chain, () => true, isUnlockMet)).toBeNull();
  });

  it('中継ノードがアンロック条件を満たしていれば従来通り経路を返す', () => {
    const chain = buildTree({
      1: { next: [2] },
      2: { pre: [1], next: [3] },
      3: { pre: [2] },
    });
    const isUnlockMet = () => true;
    expect(findEffectivePath(3, new Set([1]), chain, () => true, isUnlockMet)).toEqual([1, 2, 3]);
  });
});
