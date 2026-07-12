import { talentTree, type TreeNode } from './talentTreeData';

// ---- SVG helpers ----

export function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

// ---- BFS ----

export function bfsReachable(
  enabledIds: ReadonlySet<number>,
  nodesById: ReadonlyMap<number, TreeNode>,
  rootId: number,
): Set<number> {
  const reachable = new Set<number>();
  if (!enabledIds.has(rootId)) return reachable;
  const queue: number[] = [rootId];
  reachable.add(rootId);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const n = nodesById.get(cur);
    if (!n) continue;
    for (const nxt of n.nextNodes) {
      if (!reachable.has(nxt) && enabledIds.has(nxt)) {
        reachable.add(nxt);
        queue.push(nxt);
      }
    }
  }
  return reachable;
}

export function getSubtreeInSet(
  nodeId: number,
  set: ReadonlySet<number>,
  nodesById: ReadonlyMap<number, TreeNode>,
): Set<number> {
  const result = new Set<number>([nodeId]);
  const queue = [nodeId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const n = nodesById.get(cur);
    if (!n) continue;
    for (const nxt of n.nextNodes) {
      if (set.has(nxt) && !result.has(nxt)) {
        result.add(nxt);
        queue.push(nxt);
      }
    }
  }
  return result;
}

// talentId → 消費ポイント。既定は talent-tree.json を参照する。テストからは
// 合成ツリー用のコスト表を注入できるよう関数として差し替え可能にしている。
export type TalentCostFn = (talentId: number) => number;
const defaultTalentCost: TalentCostFn = (talentId) => talentTree.nodes[String(talentId)]?.cost ?? 0;

export function countCost(
  ids: ReadonlySet<number>,
  nodesById: ReadonlyMap<number, TreeNode>,
  getCost: TalentCostFn = defaultTalentCost,
): number {
  let c = 0;
  for (const id of ids) {
    const n = nodesById.get(id);
    c += n ? getCost(n.talentId) : 0;
  }
  return c;
}

// ---- Deselect (選択解除) ----

// unlock 条件 [type, value] の type=3: 総消費ポイント(R1+R2) >= value で解放。
export const UNLOCK_TYPE_TOTAL_POINTS = 3;

// ノードを1つ外し、ルートから到達できなくなったノードも併せて外した集合を返す。
// R1 のデセレクト、および R2 デセレクトの到達性プルーニングで共通利用する。
export function deselectNodeAndPrune(
  enabledIds: ReadonlySet<number>,
  nodeId: number,
  nodesById: ReadonlyMap<number, TreeNode>,
  rootId: number,
): Set<number> {
  const next = new Set(enabledIds);
  next.delete(nodeId);
  const afterReach = bfsReachable(next, nodesById, rootId);
  for (const id of [...next]) {
    if (!afterReach.has(id)) next.delete(id);
  }
  return next;
}

// R2 デセレクト: 到達性プルーニングに加え、総消費ポイント(R1+R2)が下がることで
// アンロック条件(type=3)を満たさなくなったノードをカスケード除去した集合を返す。
export function deselectR2NodeWithCascade(
  r2EnabledIds: ReadonlySet<number>,
  nodeId: number,
  nodesById: ReadonlyMap<number, TreeNode>,
  r2RootId: number,
  r1Used: number,
  getCost: TalentCostFn = defaultTalentCost,
): Set<number> {
  const next = deselectNodeAndPrune(r2EnabledIds, nodeId, nodesById, r2RootId);

  let cascadeChanged = true;
  let cascadeTotal = r1Used + countCost(next, nodesById, getCost);
  while (cascadeChanged) {
    cascadeChanged = false;
    // R2 ルートは unlock 条件があっても r1Full で保証されるため除外。
    // それ以外の条件付きノード(B群)と子孫(C群)を集めて A群合計を算出し、
    // 各 B 群ノードの閾値と比較する。こうすることで兄弟 B 群が互いの
    // コストを補い合う誤判定を防ぎつつ、ルート除外で過剰除去も防ぐ。
    const allBCSet = new Set<number>();
    for (const cid of next) {
      if (cid === r2RootId) continue;
      const cn = nodesById.get(cid);
      if (!cn?.unlock?.some(([t]) => t === UNLOCK_TYPE_TOTAL_POINTS)) continue;
      for (const id of getSubtreeInSet(cid, next, nodesById)) allBCSet.add(id);
    }
    const aTotal = cascadeTotal - countCost(allBCSet, nodesById, getCost);
    for (const cid of [...next]) {
      if (cid === r2RootId) continue;
      const cn = nodesById.get(cid);
      if (!cn?.unlock?.length) continue;
      const fails = cn.unlock.some(
        ([type, val]) => type === UNLOCK_TYPE_TOTAL_POINTS && aTotal < val,
      );
      if (fails) {
        next.delete(cid);
        const reach2 = bfsReachable(next, nodesById, r2RootId);
        for (const rid of [...next]) {
          if (!reach2.has(rid)) next.delete(rid);
        }
        cascadeTotal = r1Used + countCost(next, nodesById, getCost);
        cascadeChanged = true;
        break;
      }
    }
  }
  return next;
}

// ---- Effective path finder (diamond-pattern support) ----
//
// 対象ノードから有効な祖先 (enabled) へ向かって BFS を逆方向に行い、
// 最短距離の enabled 祖先群を特定する。
// その祖先群から対象ノードまでの各パスで有効化が必要なノード集合がすべて
// 同一であれば選択可能とみなし、そのパスを返す。
// ひし形パターン (A→B→D, A→C→D) でも A,B が有効なら B→D の単純パスを返す。

export function findEffectivePath(
  target: number,
  enabledIds: ReadonlySet<number>,
  nodesById: ReadonlyMap<number, TreeNode>,
  stageFilter: (n: TreeNode) => boolean,
): number[] | null {
  if (enabledIds.has(target)) return null;

  // BFS backward from target (via preNodes) without visited set to find all nearest enabled ancestors.
  type QItem = { nodeId: number; path: number[] };
  const queue: QItem[] = [{ nodeId: target, path: [target] }];
  let foundDepth = Infinity;
  const foundPaths: number[][] = [];

  while (queue.length > 0) {
    const { nodeId, path } = queue.shift()!;
    if (path.length > foundDepth) continue;

    if (enabledIds.has(nodeId) && nodeId !== target) {
      if (path.length < foundDepth) {
        foundDepth = path.length;
        foundPaths.length = 0;
      }
      foundPaths.push(path.slice().reverse());
      continue;
    }

    const node = nodesById.get(nodeId);
    if (!node || !stageFilter(node)) continue;

    for (const pre of node.preNodes) {
      if (!path.includes(pre)) {
        queue.push({ nodeId: pre, path: [...path, pre] });
      }
    }
  }

  if (foundPaths.length === 0) return null;

  // すべてのパスで有効化が必要なノード集合が同じかチェック
  const toEnable = (path: number[]) => path.filter((id) => !enabledIds.has(id));
  const firstSet = new Set(toEnable(foundPaths[0]));
  const allSame = foundPaths.every((p) => {
    const s = toEnable(p);
    return s.length === firstSet.size && s.every((id) => firstSet.has(id));
  });

  return allSame ? foundPaths[0] : null;
}
