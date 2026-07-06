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

export function countCost(
  ids: ReadonlySet<number>,
  nodesById: ReadonlyMap<number, TreeNode>,
): number {
  let c = 0;
  for (const id of ids) {
    const n = nodesById.get(id);
    const td = n ? talentTree.nodes[String(n.talentId)] : undefined;
    c += td?.cost ?? 0;
  }
  return c;
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
