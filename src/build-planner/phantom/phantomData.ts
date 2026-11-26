import seasonTalentsRaw from '../../data/season-talents.json';
import phantomFactorsRaw from '../../data/phantom-factors.json';
import { createAssetMap } from '../assetMap';

// ---- assets ----

const stAsset = createAssetMap(
  import.meta.glob<{ default: string }>(
    ['../../assets/season_talents/*.png', '!../../assets/season_talents/* #*.png'],
    { eager: true },
  ),
);

// 心相投影(シーズンタレント)関連アセットの解決。呼び出し側の従来仕様に合わせて
// 拡張子付きファイル名(例: 'img_season_talent_tree_bg2.png')を受け、未解決時は '' を返す。
export const getSTAsset = (name: string): string => stAsset(name.replace(/\.png$/, '')) ?? '';

// ZTable の icon フィールド(パス形式)→ アセットファイル名
export const iconPathToFile = (icon: string): string => (icon.split('/').pop() ?? '') + '.png';

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
  rootNodeId: number;
  icon: string;
  unlockCondition: number[][];
}

export interface IntermediateSlot {
  factorTypes: number[];
  professionIds: number[];
  icon: string;
}

// SeasonTreeNode.unlockCondition / SeasonTemplate.unlockCondition は全件
// [[93, seasonId, N]] (シーズンLv N 以上で開放。S3は[[93, 3, N]]、S4は[[93, 4, N]]) の形式
// (全ノード・全テンプレートで確認済み、他の条件パターンは存在しない)。条件なし(空配列)は
// 常時開放を意味し、必要Lvは0として扱う。S4の祈願心相晶テンプレートは全て常時開放。
export function getUnlockLevel(unlockCondition: number[][]): number {
  return unlockCondition[0]?.[2] ?? 0;
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

export interface PhantomFactorLevel {
  id: number;
  level: number;
  effects: number[][];
  buffPars?: number[][];
  fightValue: number;
  // S4祈願因子の映痕スロット構成。1要素=1スロットで、値は装着可能な映痕のAffixType
  // (1=ステータス系, 2=クラス映痕)。映痕の編集・計算は phantomAffixData.ts。
  embedSlots?: number[][];
}

export interface PhantomFactorClass {
  typeId: number;
  professionIds: number[];
  // SeasonTalentFactorItemTable.SeasonId[0]。過去シーズンの因子は現シーズンでは無効
  // (ゲーム内説明文で明記)だが、過去のセーブデータ互換のためデータは残している。
  // CURRENT_FACTOR_SEASON_ID との比較で、表示側(phantomView.ts)は選択肢からの除外を、
  // ステータス計算側(calculateRawStats.ts)は効果の除外を行う。
  seasonId: number;
  // 型の所属(特異点因子のみ。クラスの型の TalentSchoolId と同じ値)。型が一致しないと効果が出ない。
  talentSchoolId?: number;
  grades: PhantomFactorLevel[];
  icon?: string;
}

// シーズン4で絆スロット/絆レベル効果(advancedEffects/bondSlots)は廃止され、データから
// 削除された。templates/treeNodes等は現行シーズン(seasonId)の祈願心相晶のみを含む。
export const stData = seasonTalentsRaw as unknown as {
  seasonId: number;
  templates: Record<string, SeasonTemplate>;
  treeNodes: Record<string, SeasonTreeNode>;
  intermediateSlots: Record<string, IntermediateSlot>;
  ordinaryEffects: Record<string, OrdinaryEffect>;
};

export const pfData = phantomFactorsRaw as unknown as {
  factorTypes: Record<string, string>;
  byClass: Record<string, PhantomFactorClass>;
};

// 現在有効な因子シーズン(データ中の最大seasonId)。これより古いseasonIdの因子はゲーム側で
// 無効化されている(FactorItemClassの意味は同じtypeId番号のまま変わるため、名前だけでは
// 新旧を区別できない)。表示側(phantomView.ts)の選択肢除外・ステータス計算側
// (calculateRawStats.ts)の効果除外の両方で参照する単一の定義元。
export const CURRENT_FACTOR_SEASON_ID = Math.max(
  0,
  ...Object.values(pfData.byClass).map((fc) => fc.seasonId ?? 0),
);

// 因子レベル(FactorItemLevel)の上限。S3はG1-G10、S4祈願因子はG1-G3(データから算出)。
export const MAX_FACTOR_LEVEL = Math.max(
  1,
  ...Object.values(pfData.byClass).map((fc) => fc.grades.length),
);

// 因子クラスが無効化された過去シーズンのものか。S4以降、抽出データには現行シーズンの因子しか
// 含まれないため、データに存在しないclassKey(S2/S3因子)も過去シーズン扱いにする。
export function isFactorClassLegacy(classKey: string): boolean {
  const fc = pfData.byClass[classKey];
  return fc == null || fc.seasonId < CURRENT_FACTOR_SEASON_ID;
}

// テンプレートIDが現行シーズンのデータに存在しない(=廃止された過去シーズンの心相晶)か。
export function isTemplateLegacy(templateId: number | null | undefined): boolean {
  return templateId != null && stData.templates[String(templateId)] == null;
}

// 指定テンプレートが現在の潜在Lvでまだ開放されていないか。テンプレート未選択(null)は
// 「未開放」扱いしない(この関数はONトグルの自動OFF判定にのみ使う想定のため)。
export function isTemplateLocked(templateId: number | null, phantomLevel: number): boolean {
  if (templateId == null) return false;
  const tmpl = stData.templates[String(templateId)];
  if (!tmpl) return false;
  return phantomLevel < getUnlockLevel(tmpl.unlockCondition);
}

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

// buildTreeSteps の行を開放Lv(行内ノードの最小値)の昇順に並べ替える(同Lvは元の順を保つ)。
// buildTreeSteps はツリーを親→子の深さ順にたどるため、同じ親の兄弟の順はゲームデータの記述順に
// なり、開放Lvの順と一致しないことがある(例: Lv40の単独因子がLv35の選択式因子より先)。
// ノード設定一覧・効果一覧等の表示順とノード番号はこの順にする。保存データはノードIDで
// 持つため行の順に依存しない。ツリー図の座標がテンプレートから取れない場合の簡易レイアウト
// (PhantomTreeSvg)は親子の並びを前提にするため、元の buildTreeSteps の順を使う。
export function sortTreeStepsByUnlockLevel(steps: TreeStep[]): TreeStep[] {
  const stepLevel = (step: TreeStep) =>
    Math.min(
      ...step.nodeIds.map((id) =>
        getUnlockLevel(stData.treeNodes[String(id)]?.unlockCondition ?? []),
      ),
    );
  return steps
    .map((step, i) => ({ step, i, level: stepLevel(step) }))
    .sort((a, b) => a.level - b.level || a.i - b.i)
    .map(({ step }) => step);
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

// 因子に埋め込んだ映痕1つ分。group は phantom-affixes.json の Group(同一効果のまとまり)、
// quality は品質(2=上級〜5=不朽)、value はその品質の範囲内の効果値(内部値。%系は 100=1%)。
export interface PhantomAffixValue {
  group: number;
  quality: number;
  value: number;
}

export interface PhantomFactorSlotValue {
  classKey: string;
  grade: number; // 1-MAX_FACTOR_LEVEL
  // 映痕(S4祈願因子)。index はレベル別スロット構成(embedSlots)の位置、null は空きスロット。
  // 末尾の空きは持たない(phantomAffixData.ts の trimAffixes)。映痕が無ければ省略。
  affixes?: (PhantomAffixValue | null)[];
}

// 因子未装着スロットの初期選択レベル(S4祈願因子はFactorItemLevel 1-3)。現時点では日付に
// 連動させずG2固定とする(日付連動が必要になったら seasonSchedule.ts の getGsScheduleTier を使う)。
const DEFAULT_FACTOR_LEVEL = 2;

export function getDefaultFactorLevel(): number {
  return DEFAULT_FACTOR_LEVEL;
}

// ロード対象の心相投影データ(自動保存/保存プラン/プランコード共通)のうち、リセット判定に使う部分。
export type PhantomSaveState =
  | {
      saveSeasonId?: number;
      phantomTemplateId?: number | null;
      phantomFactorSlots?: Record<number, PhantomFactorSlotValue | null>;
    }
  | null
  | undefined;

// ロード対象の心相投影データ(自動保存/保存プラン/プランコード共通)が、廃止された過去シーズンの
// 心相晶テンプレート(S4ではS3潜在心相晶のテンプレート1-8)を選択しているか、無効化された過去
// シーズンの因子を1つでも装着しているか。該当する場合、呼び出し側(store)は心相投影の状態
// (有効化/シーズンLv/テンプレート/ノード選択/因子装着)をリセットし、ユーザーに通知する
// (docs/CHARACTER_DATA_MODEL.md の「心相投影・幻影因子」章を参照)。
export function hasLegacyPhantomData(state: PhantomSaveState): boolean {
  if (!state) return false;
  if (isTemplateLegacy(state.phantomTemplateId)) return true;
  if (!state.phantomFactorSlots) return false;
  return Object.values(state.phantomFactorSlots).some(
    (slot) => slot != null && isFactorClassLegacy(slot.classKey),
  );
}

// 心相晶テンプレートを選択しているか、因子を1つでも装着しているか(リセット時の通知要否の判定用)。
export function hasPhantomData(state: PhantomSaveState): boolean {
  if (!state) return false;
  if (state.phantomTemplateId != null) return true;
  return Object.values(state.phantomFactorSlots ?? {}).some((slot) => slot != null);
}
