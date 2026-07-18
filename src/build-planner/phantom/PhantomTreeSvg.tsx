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
const BRANCH_OFFSET = 96;

function nodePos(si: number, mi: number, total: number): [number, number] {
  const y = si * ROW_H + ROW_H / 2;
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
  const nodePositions = useMemo(() => {
    const map = new Map<number, [number, number]>();
    treeSteps.forEach((step, idx) => {
      step.nodeIds.forEach((nodeId, mi) => {
        map.set(nodeId, nodePos(idx, mi, step.nodeIds.length));
      });
    });
    return map;
  }, [treeSteps]);

  const nodeRadii = useMemo(() => {
    const map = new Map<number, number>();
    treeSteps.forEach((step, si) => {
      step.nodeIds.forEach((nid) => {
        const node = stData.treeNodes[String(nid)];
        if (!node) {
          map.set(nid, R_NODE);
          return;
        }
        if (node.nodeType === 2) {
          map.set(nid, R_FACTOR);
          return;
        }
        map.set(nid, si === 0 ? R_ROOT : R_NODE);
      });
    });
    return map;
  }, [treeSteps]);

  const childrenMap = useMemo(() => buildChildrenMap(phantomTemplateId), [phantomTemplateId]);

  const svgHeight = treeSteps.length * ROW_H;

  const renderLines = () =>
    treeSteps.flatMap((step) =>
      step.nodeIds.flatMap((nodeId) => {
        const pos = nodePositions.get(nodeId);
        if (!pos) return [];
        const [nx, ny] = pos;
        const fromR = nodeRadii.get(nodeId) ?? R_NODE;
        const fromY = ny + fromR;
        return (childrenMap.get(nodeId) ?? []).flatMap((nextId) => {
          const nextPos = nodePositions.get(nextId);
          if (!nextPos) return [];
          const [nnx, nny] = nextPos;
          const toR = nodeRadii.get(nextId) ?? R_NODE;
          const toY = nny - toR;
          const isActivePath = isEffectivelyActive(nodeId) && isEffectivelyActive(nextId);
          return [
            <line
              key={`${nodeId}-${nextId}`}
              x1={nx}
              y1={fromY}
              x2={nnx}
              y2={toY}
              stroke={isActivePath ? '#f4a13a' : '#2a2a3a'}
              strokeWidth={isActivePath ? 4 : 2}
              strokeDasharray={isActivePath ? undefined : '5 3'}
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
        ? 'img_season_talent_tree_big_bg_select.png'
        : isActive
          ? 'img_season_talent_tree_bg2.png'
          : 'img_season_talent_tree_bg2_lock.png';
      const iconR = r * 0.68;
      return (
        <g key={nodeId} onClick={handleClick} style={{ cursor: 'pointer' }}>
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
            <circle
              cx={nx}
              cy={ny}
              r={r + 6}
              fill="none"
              stroke="#ffe066"
              strokeWidth={3}
              strokeDasharray="5 3"
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
        <g key={nodeId} onClick={handleClick} style={{ cursor: 'pointer' }}>
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
            <circle
              cx={nx}
              cy={ny}
              r={r + 6}
              fill="none"
              stroke="#ffe066"
              strokeWidth={3}
              strokeDasharray="5 3"
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
      {renderLines()}
      {treeSteps.flatMap((step, si) => step.nodeIds.map((nodeId) => renderNode(nodeId, si)))}
    </svg>
  );
}
