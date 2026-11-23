import { useMemo } from 'react';
import type { PhantomFactorSlotValue, TreeStep } from './phantomData';
import { buildChildrenMap, getSTAsset, iconPathToFile, pfData, stData } from './phantomData';
import { computeOathTreeLayout, TREE_UNIT_SCALE } from './phantomTreeLayout';

// 心相投影ツリーのSVG描画(接続線 + ノード)。PhantomPanel から分離したもので、
// ノードクリックによる選択トグル以外の状態は持たない。

// ノード各部の描画サイズ。祈願心相晶のUIプレハブ(season_talent_4_*)の RectTransform の
// サイズ(ゲーム内UI単位)を、ノード座標と同じ倍率でSVG座標に換算する。
// 背景画像は余白込みの画像サイズ(bg2=106、quality*=120、bg1=350x170)で配置する。
const u = (gameUnits: number) => gameUnits * TREE_UNIT_SCALE;
const NODE_SIZE = {
  rootBgW: u(350),
  rootBgH: u(170),
  rootIcon: u(106 - 14),
  // 選択枠はノード枠(ルート106/通常74)に32を足したサイズに伸縮して表示される(画像は同じbg2_select)。
  rootSelect: u(106 + 32),
  basicBg: u(106),
  basicIcon: u(74 - 14),
  basicSelect: u(74 + 32),
  factorBg: u(120),
  factorIcon: u(98 - 20),
  factorSelect: u(130),
  lock: u(30),
  // 複数から1つを選ぶノードの、選ばれなかった側に重ねるアイコン(画像は28x28)。
  empty: u(28),
};

// ---- レイアウト定数 (100%ズーム時に基本サイズの2倍) ----
const ROW_H = 140;
const SVG_VW = 480;
const CX = SVG_VW / 2;

function nodePos(row: number, mi: number, total: number): [number, number] {
  // 分岐(左右2点)から合流(下1点)までの菱形の対角線が正方形になるよう、
  // 分岐の横オフセットは分岐~合流の縦距離(ROW_H)と同じ値にする。
  const BRANCH_OFFSET = ROW_H;
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
  // 祈願心相晶の形のツリーは放射状レイアウト(phantomTreeLayout.ts)を優先する。
  const { nodePositions, svgWidth, svgHeight } = useMemo(() => {
    const oath = computeOathTreeLayout(phantomTemplateId);
    if (oath) {
      return { nodePositions: oath.positions, svgWidth: oath.width, svgHeight: oath.height };
    }
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
    return { nodePositions: map, svgWidth: SVG_VW, svgHeight: row * ROW_H };
  }, [treeSteps, phantomTemplateId]);

  const childrenMap = useMemo(() => buildChildrenMap(phantomTemplateId), [phantomTemplateId]);

  // 複数の候補から1つを選ぶステップ(分岐の選択・因子タイプ選択・経路で決まる因子)に属するノード。
  const choiceNodeIds = useMemo(
    () => new Set(treeSteps.filter((s) => s.nodeIds.length > 1).flatMap((s) => s.nodeIds)),
    [treeSteps],
  );

  // 接続線。ゲーム内のプレハブ(line_<from>_<to>: 幅2の直線画像を回転配置)と同じく直線で、
  // 色もプレハブに合わせる(取得済み: 水色 143,213,255 +発光 / 未取得: 半透明の白)。
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
              stroke={isActivePath ? 'rgb(143 213 255)' : 'rgb(255 255 255 / 0.35)'}
              strokeWidth={isActivePath ? 4 : 2.4}
              filter={isActivePath ? 'url(#phantom-tree-glow)' : undefined}
            />,
          ];
        });
      }),
    );

  // 正方形の画像を中心(cx,cy)・一辺sizeで配置する。
  const squareImage = (file: string, cx: number, cy: number, size: number, opacity?: number) => (
    <image
      href={getSTAsset(file)}
      x={cx - size / 2}
      y={cy - size / 2}
      width={size}
      height={size}
      opacity={opacity}
    />
  );

  const renderNode = (nodeId: number, si: number) => {
    const node = stData.treeNodes[String(nodeId)];
    if (!node) return null;
    const [nx, ny] = nodePositions.get(nodeId) ?? [CX, 0];
    const isActive = isEffectivelyActive(nodeId);
    const isSelected = selectedNodeId === nodeId;
    const isRoot = si === 0;
    const handleClick = () => onToggleNode(nodeId);
    // 未取得ノードは背景・アイコンを薄くしてロックアイコンを重ねる(ゲーム内のロック表示と同じ
    // 透明度。ルートは常に取得済み扱いで薄くしない)。祈願Lvの条件は満たしているが、複数から
    // 1つを選ぶノードで選ばれなかった側は、ロックの代わりに set_empty アイコンを重ねる。
    const dimmed = !isActive && !isRoot;
    const isUnchosen = dimmed && choiceNodeIds.has(nodeId) && levelUnlockedNodeIds.has(nodeId);
    const lockOverlay =
      dimmed &&
      (isUnchosen
        ? squareImage('set_empty.png', nx, ny, NODE_SIZE.empty)
        : squareImage('img_season_talent_tree_lock.png', nx, ny, NODE_SIZE.lock));

    if (node.nodeType === 1) {
      const oe = stData.ordinaryEffects[String(nodeId)];
      const iconFile = oe ? iconPathToFile(oe.icon) : '';
      const iconSize = isRoot ? NODE_SIZE.rootIcon : NODE_SIZE.basicIcon;
      return (
        <g
          key={nodeId}
          className="phantom-tree-node"
          onClick={handleClick}
          style={{ cursor: 'pointer' }}
          data-selected={isSelected || undefined}
        >
          {isRoot ? (
            <image
              href={getSTAsset('img_season_talent_tree_bg1.png')}
              x={nx - NODE_SIZE.rootBgW / 2}
              y={ny - NODE_SIZE.rootBgH / 2}
              width={NODE_SIZE.rootBgW}
              height={NODE_SIZE.rootBgH}
            />
          ) : (
            squareImage(
              'img_season_talent_tree_bg2.png',
              nx,
              ny,
              NODE_SIZE.basicBg,
              dimmed ? 0.5 : undefined,
            )
          )}
          {iconFile &&
            squareImage(iconFile, nx, ny, iconSize, isRoot ? 0.8 : dimmed ? 0.4 : undefined)}
          {lockOverlay}
          {isSelected &&
            squareImage(
              'img_season_talent_tree_bg2_select.png',
              nx,
              ny,
              isRoot ? NODE_SIZE.rootSelect : NODE_SIZE.basicSelect,
            )}
        </g>
      );
    } else {
      const slot = stData.intermediateSlots[String(nodeId)];
      const qualityFile = slot ? iconPathToFile(slot.icon) : 'img_season_talent_tree_quality1.png';
      const current = phantomFactorSlots[node.groupId] ?? null;
      const factorIconName = current ? pfData.byClass[current.classKey]?.icon : null;
      return (
        <g
          key={nodeId}
          className="phantom-tree-node"
          onClick={handleClick}
          style={{ cursor: 'pointer' }}
          data-selected={isSelected || undefined}
        >
          {squareImage(qualityFile, nx, ny, NODE_SIZE.factorBg, dimmed ? 0.3 : undefined)}
          {factorIconName &&
            isActive &&
            squareImage(factorIconName + '.png', nx, ny, NODE_SIZE.factorIcon)}
          {lockOverlay}
          {isSelected &&
            squareImage('img_season_talent_tree_big_bg_select.png', nx, ny, NODE_SIZE.factorSelect)}
        </g>
      );
    }
  };

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      width={svgWidth * zoom}
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
          width={svgWidth + 40}
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
