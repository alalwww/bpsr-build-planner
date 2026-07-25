import { useMemo } from 'react';
import type { PhantomFactorSlotValue, TreeStep } from './phantomData';
import { buildChildrenMap, getSTAsset, iconPathToFile, pfData, stData } from './phantomData';

// 心相投影ツリーのSVG描画(接続線 + ノード)。PhantomPanel から分離したもので、
// ノードクリックによる選択トグル以外の状態は持たない。

// ---- レイアウト定数 (100%ズーム時に基本サイズの2倍) ----
const ROW_H = 140;
const SVG_VW = 480;
const CX = SVG_VW / 2;
const R_ROOT = 44;
const R_NODE = 32;
const R_FACTOR = 32;
// 分岐(左右2点)から合流(下1点)までの菱形の対角線が正方形になるよう、
// 分岐の横オフセットは分岐~合流の縦距離(ROW_H)と同じ値にする。
const BRANCH_OFFSET = ROW_H;

function nodePos(row: number, mi: number, total: number): [number, number] {
  const y = row * ROW_H + ROW_H / 2;
  let x: number;
  if (total === 2) {
    x = mi === 0 ? CX - BRANCH_OFFSET : CX + BRANCH_OFFSET;
  } else if (total === 3) {
    x = mi === 0 ? CX - BRANCH_OFFSET : mi === 2 ? CX + BRANCH_OFFSET : CX;
  } else {
    x = CX;
  }
  return [x, y];
}

// 「分岐の共通の親からもう1本生えているだけの単独ノード(例: 真実ノード)」かどうかを判定する。
// このようなノードは合流には参加せず、分岐と同じ行の中央に添える形で配置し、
// 専用の行を消費しない(その分だけ後続行を詰める)。
function isAttachedLeaf(step: TreeStep, prevStep: TreeStep | null): boolean {
  if (step.nodeIds.length !== 1 || prevStep == null || prevStep.nodeIds.length < 2) return false;
  const leaf = stData.treeNodes[String(step.nodeIds[0])];
  if (!leaf || leaf.preNodes.length !== 1) return false;
  const parentId = leaf.preNodes[0];
  return prevStep.nodeIds.every((id) => {
    const n = stData.treeNodes[String(id)];
    return n != null && n.preNodes.length === 1 && n.preNodes[0] === parentId;
  });
}

interface PhantomTreeSvgProps {
  treeSteps: TreeStep[];
  phantomTemplateId: number;
  /** path-factor の未選択側を除いた、視覚的にアクティブなノード集合。 */
  visuallyActiveNodeIds: ReadonlySet<number>;
  /** 潜在Lvがノード個別の開放Lvに達しているノードの集合。未達なら不活性表示にする。 */
  levelUnlockedNodeIds: ReadonlySet<number>;
  selectedNodeId: number | null;
  phantomNodeSelections: Record<number, number>;
  phantomFactorSlots: Record<number, PhantomFactorSlotValue | null>;
  zoom: number;
  onToggleNode: (nodeId: number) => void;
}

export default function PhantomTreeSvg({
  treeSteps,
  phantomTemplateId,
  visuallyActiveNodeIds,
  levelUnlockedNodeIds,
  selectedNodeId,
  phantomNodeSelections,
  phantomFactorSlots,
  zoom,
  onToggleNode,
}: PhantomTreeSvgProps) {
  // パス上アクティブ、かつ潜在Lvがそのノードの開放Lvに達している場合のみ「取得済み」扱い。
  const isEffectivelyActive = (nodeId: number) =>
    visuallyActiveNodeIds.has(nodeId) && levelUnlockedNodeIds.has(nodeId);
  // 各ステップに行(row)を割り当てて座標化する。「真実」ノードのような、分岐の共通の親から
  // もう1本生えているだけの単独ノードは合流に参加しないため、専用の行を割かず分岐と同じ行の
  // 中央に配置する(ゲーム内表示と同じレイアウト)。
  const { nodePositions, rowCount } = useMemo(() => {
    const map = new Map<number, [number, number]>();
    let row = 0;
    treeSteps.forEach((step, idx) => {
      const prevStep = idx > 0 ? treeSteps[idx - 1] : null;
      if (isAttachedLeaf(step, prevStep)) {
        const branchY = map.get(prevStep!.nodeIds[0])?.[1] ?? row * ROW_H + ROW_H / 2;
        map.set(step.nodeIds[0], [CX, branchY]);
        return;
      }
      step.nodeIds.forEach((nodeId, mi) => {
        map.set(nodeId, nodePos(row, mi, step.nodeIds.length));
      });
      row += 1;
    });
    return { nodePositions: map, rowCount: row };
  }, [treeSteps]);

  const childrenMap = useMemo(() => buildChildrenMap(phantomTemplateId), [phantomTemplateId]);

  const svgHeight = rowCount * ROW_H;

  const renderLines = () =>
    treeSteps.flatMap((step) =>
      step.nodeIds.flatMap((nodeId) => {
        const pos = nodePositions.get(nodeId);
        if (!pos) return [];
        const [nx, ny] = pos;
        return (childrenMap.get(nodeId) ?? []).flatMap((nextId) => {
          const nextPos = nodePositions.get(nextId);
          if (!nextPos) return [];
          const [nnx, nny] = nextPos;
          const isActivePath = isEffectivelyActive(nodeId) && isEffectivelyActive(nextId);
          return [
            <line
              key={`${nodeId}-${nextId}`}
              x1={nx}
              y1={ny}
              x2={nnx}
              y2={nny}
              stroke={isActivePath ? '#ffb3d7' : '#2a2a3a'}
              strokeWidth={isActivePath ? 4 : 2}
              strokeDasharray={isActivePath ? undefined : '5 3'}
              filter={isActivePath ? 'url(#phantom-tree-glow)' : undefined}
            />,
          ];
        });
      }),
    );

  const renderNode = (nodeId: number, si: number) => {
    const node = stData.treeNodes[String(nodeId)];
    if (!node) return null;
    const [nx, ny] = nodePositions.get(nodeId) ?? [CX, 0];
    const isActive = isEffectivelyActive(nodeId);
    const isSelected = selectedNodeId === nodeId;
    const isRoot = si === 0;
    const isChosenChoice =
      node.sameGroupId !== 0 && phantomNodeSelections[node.sameGroupId] === nodeId;
    const handleClick = () => onToggleNode(nodeId);

    if (node.nodeType === 1) {
      const r = isRoot ? R_ROOT : R_NODE;
      const oe = stData.ordinaryEffects[String(nodeId)];
      const iconFile = oe ? iconPathToFile(oe.icon) : '';
      const bgFile = isRoot
        ? 'img_season_talent_tree_quality5.png'
        : isActive
          ? 'img_season_talent_tree_bg2.png'
          : 'img_season_talent_tree_bg2_lock.png';
      const iconR = r * 0.68;
      return (
        <g
          key={nodeId}
          className="phantom-tree-node"
          onClick={handleClick}
          style={{ cursor: 'pointer' }}
        >
          <image href={getSTAsset(bgFile)} x={nx - r} y={ny - r} width={r * 2} height={r * 2} />
          {iconFile && (
            <image
              href={getSTAsset(iconFile)}
              x={nx - iconR}
              y={ny - iconR}
              width={iconR * 2}
              height={iconR * 2}
            />
          )}
          {!isActive && !isRoot && <circle cx={nx} cy={ny} r={r} fill="rgba(0,0,0,0.5)" />}
          {isChosenChoice && (
            <circle cx={nx} cy={ny} r={r + 4} fill="none" stroke="#ffffff" strokeWidth={3} />
          )}
          {isSelected && (
            <image
              href={getSTAsset('img_season_talent_tree_big_bg_select.png')}
              x={nx - (r + 8)}
              y={ny - (r + 8)}
              width={(r + 8) * 2}
              height={(r + 8) * 2}
            />
          )}
        </g>
      );
    } else {
      const r = R_FACTOR;
      const slot = stData.intermediateSlots[String(nodeId)];
      const qualityFile = slot ? iconPathToFile(slot.icon) : 'img_season_talent_tree_quality1.png';
      const current = phantomFactorSlots[node.groupId] ?? null;
      const factorIconName = current ? pfData.byClass[current.classKey]?.icon : null;
      const factorIconSrc = factorIconName ? getSTAsset(factorIconName + '.png') : '';
      const iconR = r * 0.7;
      return (
        <g
          key={nodeId}
          className="phantom-tree-node"
          onClick={handleClick}
          style={{ cursor: 'pointer' }}
        >
          <image
            href={getSTAsset(qualityFile)}
            x={nx - r}
            y={ny - r}
            width={r * 2}
            height={r * 2}
          />
          {factorIconSrc && isActive && (
            <image
              href={factorIconSrc}
              x={nx - iconR}
              y={ny - iconR}
              width={iconR * 2}
              height={iconR * 2}
            />
          )}
          {!isActive && (
            <image
              href={getSTAsset('img_season_talent_tree_bg2_lock.png')}
              x={nx - r}
              y={ny - r}
              width={r * 2}
              height={r * 2}
            />
          )}
          {isSelected && (
            <image
              href={getSTAsset('img_season_talent_tree_big_bg_select.png')}
              x={nx - (r + 8)}
              y={ny - (r + 8)}
              width={(r + 8) * 2}
              height={(r + 8) * 2}
            />
          )}
        </g>
      );
    }
  };

  return (
    <svg
      viewBox={`0 0 ${SVG_VW} ${svgHeight}`}
      width={SVG_VW * zoom}
      height={svgHeight * zoom}
      className="phantom-tree-svg"
    >
      <defs>
        {/* filterUnits既定だと真横/真縦のlineはbboxの幅または高さが0になり描画されなくなるため、userSpaceOnUseで回避 */}
        <filter
          id="phantom-tree-glow"
          filterUnits="userSpaceOnUse"
          x={-20}
          y={-20}
          width={SVG_VW + 40}
          height={svgHeight + 40}
        >
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {renderLines()}
      {treeSteps.flatMap((step, si) => step.nodeIds.map((nodeId) => renderNode(nodeId, si)))}
    </svg>
  );
}
