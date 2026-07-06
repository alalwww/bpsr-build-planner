import seasonTalentsRaw from '../../data/season-talents.json';
import phantomFactorsRaw from '../../data/phantom-factors.json';

// ---- raw data types ----

export interface SeasonTreeNode {
  templateId: number;
  nodeType: 1 | 2;
  groupId: number;
  preNodes: number[];
  nextNodes: number[];
  unlockCondition: number[][];
  sameGroupId: number;
}

export interface SeasonTemplate {
  sortId: number;
  advancedEffectId: number;
  rootNodeId: number;
  icon: string;
  unlockCondition: number[][];
}

export interface IntermediateSlot {
  factorTypes: number[];
  professionIds: number[];
  icon: string;
}

export interface OrdinaryEffect {
  id: number;
  level: number;
  effects: number[][];
  buffValueKeys: string[][];
  buffPars: number[][];
  icon: string;
  unlockConsume: number[][];
  fightValue: number;
}

export interface AdvancedEffect {
  effectId: number;
  level: number;
  effects: number[][];
  buffValueKeys: string[][];
  buffPars: number[][];
  icon: string;
  unlockFraction: number;
  fightValue: number;
}

export interface BondSlot {
  templateId: number;
  slotIndex: number;
  unlockCondition: number[][];
}

export interface PhantomFactorGrade {
  id: number;
  level: number;
  effects: number[][];
  buffPars?: number[][];
  fightValue: number;
}

export interface PhantomFactorClass {
  typeId: number;
  professionIds: number[];
  grades: PhantomFactorGrade[];
  icon?: string;
}

export const stData = seasonTalentsRaw as unknown as {
  templates: Record<string, SeasonTemplate>;
  treeNodes: Record<string, SeasonTreeNode>;
  intermediateSlots: Record<string, IntermediateSlot>;
  ordinaryEffects: Record<string, OrdinaryEffect>;
  advancedEffects: Record<string, AdvancedEffect>;
  bondSlots: Record<string, BondSlot>;
};

export const pfData = phantomFactorsRaw as unknown as {
  factorTypes: Record<string, string>;
  byClass: Record<string, PhantomFactorClass>;
};

// ---- tree step types ----

export type TreeStepKind =
  | 'fixed-ordinary' // root / terminal (sameGroupId=0, nodeType=1)
  | 'choice-ordinary' // user picks one of 2 ordinaryEffect nodes
  | 'solo-factor' // single factor slot (sameGroupId=0)
  | 'choice-factor-type' // user picks factor type (sameGroupId, same preNodes, nodeType=2)
  | 'path-factor'; // path-determined factor slot (sameGroupId, diff preNodes, nodeType=2)

export interface TreeStep {
  kind: TreeStepKind;
  nodeIds: number[];
  sameGroupId: number;
}

// ---- helper: same preNodes check ----

export function areSamePreNodes(members: SeasonTreeNode[]): boolean {
  if (members.length === 0) return true;
  const refPreSet = new Set(members[0].preNodes);
  return members.every(
    (m) => m.preNodes.length === refPreSet.size && m.preNodes.every((p) => refPreSet.has(p)),
  );
}

// path-factor ノードの並び替え用: preNode がどのステップの何番目(左右順)に
// 配置されているかを既に確定した steps から逆引きする。見つからない場合は 0。
function findPreNodeOrder(member: SeasonTreeNode, steps: TreeStep[]): number {
  const preId = member.preNodes[0];
  if (preId == null) return 0;
  for (const s of steps) {
    const idx = s.nodeIds.indexOf(preId);
    if (idx !== -1) return idx;
  }
  return 0;
}

// ---- children map (preNodes の逆引き) ----
// NextNode が空でも PreNode から子を導出できるよう両方向を統合する
export function buildChildrenMap(templateId: number): Map<number, number[]> {
  const nodes = stData.treeNodes;
  const map = new Map<number, number[]>();
  for (const [idStr, node] of Object.entries(nodes)) {
    if (node.templateId !== templateId) continue;
    const id = parseInt(idStr);
    // nextNodes からの子
    for (const nid of node.nextNodes) {
      if (!map.has(id)) map.set(id, []);
      if (!map.get(id)!.includes(nid)) map.get(id)!.push(nid);
    }
    // preNodes の逆引き（この node を子として親に登録）
    for (const pid of node.preNodes) {
      if (!map.has(pid)) map.set(pid, []);
      if (!map.get(pid)!.includes(id)) map.get(pid)!.push(id);
    }
  }
  return map;
}

// ---- build ordered tree steps via BFS ----

export function buildTreeSteps(rootId: number, templateId: number): TreeStep[] {
  const nodes = stData.treeNodes;
  const childrenMap = buildChildrenMap(templateId);
  const steps: TreeStep[] = [];
  const visited = new Set<number>();
  let queue = [rootId];

  while (queue.length > 0) {
    const nextQueue: number[] = [];
    for (const nodeId of queue) {
      if (visited.has(nodeId)) continue;
      const node = nodes[String(nodeId)];
      if (!node) continue;

      const sgId = node.sameGroupId;
      if (sgId !== 0) {
        const members = Object.values(nodes).filter(
          (n) => n.sameGroupId === sgId && n.templateId === templateId,
        );
        const rawIds = members.map((m) => m.groupId);
        const minId = Math.min(...rawIds);
        if (visited.has(minId)) continue;
        rawIds.forEach((id) => visited.add(id));

        const samePreNodes = areSamePreNodes(members);
        let kind: TreeStepKind;
        if (node.nodeType === 1) kind = 'choice-ordinary';
        else if (samePreNodes) kind = 'choice-factor-type';
        else kind = 'path-factor';

        // path-factor はメンバーごとに preNode が異なるため、単純な groupId 昇順だと
        // 親の左右位置と食い違い接続線が交差することがある。各メンバーの preNode が
        // 既に配置されているステップ内の左右順に合わせて並べ、親子の位置を一致させる。
        const ids =
          kind === 'path-factor'
            ? [...members]
                .sort((a, b) => findPreNodeOrder(a, steps) - findPreNodeOrder(b, steps))
                .map((m) => m.groupId)
            : [...rawIds].sort((a, b) => a - b);

        steps.push({ kind, nodeIds: ids, sameGroupId: sgId });

        const nextSet = new Set<number>();
        members.forEach((m) => {
          (childrenMap.get(m.groupId) ?? []).forEach((n) => nextSet.add(n));
        });
        nextSet.forEach((n) => {
          if (!visited.has(n)) nextQueue.push(n);
        });
      } else {
        visited.add(nodeId);
        const kind: TreeStepKind = node.nodeType === 1 ? 'fixed-ordinary' : 'solo-factor';
        steps.push({ kind, nodeIds: [nodeId], sameGroupId: 0 });
        (childrenMap.get(nodeId) ?? []).forEach((n) => {
          if (!visited.has(n)) nextQueue.push(n);
        });
      }
    }
    queue = [...new Set(nextQueue)];
  }

  return steps;
}

// ---- compute active node ids ----

export function getActivePhantomNodeIds(
  rootId: number,
  templateId: number,
  nodeSelections: Record<number, number>,
): Set<number> {
  const nodes = stData.treeNodes;
  const childrenMap = buildChildrenMap(templateId);
  const active = new Set<number>();
  const queue = [rootId];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (active.has(nodeId)) continue;
    const node = nodes[String(nodeId)];
    if (!node) continue;

    const sgId = node.sameGroupId;
    if (sgId !== 0) {
      const members = Object.values(nodes).filter(
        (n) => n.sameGroupId === sgId && n.templateId === templateId,
      );
      if (areSamePreNodes(members)) {
        if (nodeSelections[sgId] !== nodeId) continue;
      } else {
        if (!node.preNodes.some((pid) => active.has(pid))) continue;
      }
    }

    active.add(nodeId);
    for (const nextId of childrenMap.get(nodeId) ?? []) {
      if (!active.has(nextId)) queue.push(nextId);
    }
  }

  return active;
}

// ---- default node selections for a template ----

export function initPhantomNodeSelections(templateId: number): Record<number, number> {
  const nodes = stData.treeNodes;
  const result: Record<number, number> = {};
  const seen = new Set<number>();

  for (const node of Object.values(nodes)) {
    if (node.templateId !== templateId || node.sameGroupId === 0) continue;
    const sgId = node.sameGroupId;
    if (seen.has(sgId)) continue;
    seen.add(sgId);

    const members = Object.values(nodes).filter(
      (n) => n.sameGroupId === sgId && n.templateId === templateId,
    );
    if (areSamePreNodes(members)) {
      const minId = Math.min(...members.map((m) => m.groupId));
      result[sgId] = minId;
    }
  }

  return result;
}

// ---- factor slot state type ----

export interface PhantomFactorSlotValue {
  classKey: string;
  grade: number; // 1-10
}
