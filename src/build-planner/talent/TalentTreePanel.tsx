import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import './talent.css';
import { renderMarkup } from '../components/renderMarkup';
import ConfirmDialog from '../components/ConfirmDialog';
import FloatingTooltip from '../components/FloatingTooltip';
import type { ProfessionKey, ProfessionTypeKey } from '../profession';
import { PROFESSIONS } from '../profession';
import { useBuildStore } from '../store/useBuildStore';
import {
  classesData,
  DEFAULT_ROLE_THEME,
  getBgUrl,
  getTalentIconUrl,
  ROLE_ICON_NAMES,
  ROLE_THEMES,
  type StageInfo,
  TALENT_ICON_MAP,
  type TalentNodeData,
  talentTree,
  type TreeNode,
} from './talentTreeData';
import {
  bfsReachable,
  countCost,
  findEffectivePath,
  getSubtreeInSet,
  hexPoints,
} from './talentTreeAlgo';

// ---- constants ----

const R1_MAX = 30;
const R2_MAX = 40;
const BASE_NR = 11;
const PADDING = 52;
const ZOOM_STEP = 0.2;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3.0;

// ---- Tooltip ----

interface HoveredNodeInfo {
  node: TreeNode;
  td: TalentNodeData | undefined;
  name: string;
  desc: string;
  unlockRequired: number | null;
  x: number; // tooltip position (icon rect right + 10)
  y: number; // tooltip position (icon rect top)
}

// ---- Component ----

interface Props {
  professionKey: ProfessionKey;
  professionTypeKey: ProfessionTypeKey;
  onSelectProfessionType: (key: ProfessionTypeKey) => void;
}

export default function TalentTreePanel({
  professionKey,
  professionTypeKey,
  onSelectProfessionType,
}: Props) {
  const { t: tUi } = useTranslation();
  const { t } = useTranslation('game-data');

  const { r1EnabledIds, r2EnabledIds } = useBuildStore(
    useShallow((s) => ({ r1EnabledIds: s.talentR1EnabledIds, r2EnabledIds: s.talentR2EnabledIds })),
  );
  const onR1EnabledIdsChange = useBuildStore((s) => s.setTalentR1EnabledIds);
  const onR2EnabledIdsChange = useBuildStore((s) => s.setTalentR2EnabledIds);

  const profession = PROFESSIONS[professionKey];
  const wt = profession.professionId;

  const talentRole = classesData[String(wt)]?.talent ?? 1;
  const roleTheme = ROLE_THEMES[talentRole] ?? DEFAULT_ROLE_THEME;
  const roleBgIconUrl = TALENT_ICON_MAP[ROLE_ICON_NAMES[talentRole] ?? ''];
  const genreBgIconUrl = TALENT_ICON_MAP['talent_icon_genre'];
  const residueIconUrl = TALENT_ICON_MAP['talent_icon_residue'];

  const allNodes = useMemo(
    () => (talentTree.treeNodesByWeaponType[String(wt)] ?? []) as TreeNode[],
    [wt],
  );
  const stages = useMemo(
    () => (talentTree.stagesByWeaponType[String(wt)] ?? []) as StageInfo[],
    [wt],
  );
  const nodesById = useMemo(() => {
    const m = new Map<number, TreeNode>();
    for (const n of allNodes) m.set(n.id, n);
    return m;
  }, [allNodes]);

  const stage0Info = useMemo(() => stages.find((s) => s.stage === 0), [stages]);
  const stage1Infos = useMemo(() => stages.filter((s) => s.stage === 1), [stages]);

  const [activeBdType, setActiveBdType] = useState<0 | 1>(professionTypeKey === 'type1' ? 0 : 1);
  const [activeStage, setActiveStage] = useState<'r1' | 'r2'>('r2');
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [hoveredNodeInfo, setHoveredNodeInfo] = useState<HoveredNodeInfo | null>(null);
  const tooltipCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleTooltipClose = () => {
    if (tooltipCloseTimerRef.current !== null) clearTimeout(tooltipCloseTimerRef.current);
    tooltipCloseTimerRef.current = setTimeout(() => setHoveredNodeInfo(null), 120);
  };
  const cancelTooltipClose = () => {
    if (tooltipCloseTimerRef.current !== null) {
      clearTimeout(tooltipCloseTimerRef.current);
      tooltipCloseTimerRef.current = null;
    }
  };
  const [pendingSwitchBdType, setPendingSwitchBdType] = useState<0 | 1 | null>(null);
  const [pendingR1Deselect, setPendingR1Deselect] = useState<number | null>(null);
  const [pendingReset, setPendingReset] = useState(false);

  // professionTypeKey が変化したとき activeBdType を同期（プランロード時も含む）
  useEffect(() => {
    setActiveBdType(professionTypeKey === 'type1' ? 0 : 1);
  }, [professionTypeKey]);

  // professionKey が変わったらダイアログ状態をリセット
  useEffect(() => {
    setPendingSwitchBdType(null);
    setPendingR1Deselect(null);
    setPendingReset(false);
  }, [professionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeStage1Info = useMemo(
    () => stage1Infos.find((s) => s.bdType === activeBdType),
    [stage1Infos, activeBdType],
  );

  const setR1EnabledIds = onR1EnabledIdsChange;
  const setR2EnabledIds = onR2EnabledIdsChange;

  // R1 全選択判定: stage-0 ノード数と r1EnabledIds のサイズを比較
  const r1NodeCount = useMemo(() => allNodes.filter((n) => n.stage === 0).length, [allNodes]);
  const r1Full = r1NodeCount > 0 && r1EnabledIds.size >= r1NodeCount;

  // R2 ルートノードを常に選択済み初期状態にする
  const r2RootId = activeStage1Info?.rootId;
  useEffect(() => {
    if (r2RootId == null || r2EnabledIds.has(r2RootId)) return;
    setR2EnabledIds(new Set([r2RootId, ...r2EnabledIds]));
  }, [r2RootId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl+Wheel zoom for canvas area
  useEffect(() => {
    const el = canvasWrapperRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoomLevel((z) =>
        Math.max(
          ZOOM_MIN,
          Math.min(ZOOM_MAX, parseFloat((z + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)).toFixed(1))),
        ),
      );
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // R1 未完了時は R2 を実質的に空とみなす（表示・操作ともにブロック）
  const effectiveR2EnabledIds = useMemo(
    () => (r1Full ? r2EnabledIds : new Set<number>()),
    [r1Full, r2EnabledIds],
  );

  const enabledIds = activeStage === 'r1' ? r1EnabledIds : effectiveR2EnabledIds;
  const setEnabledIds = activeStage === 'r1' ? setR1EnabledIds : setR2EnabledIds;
  const rootId = activeStage === 'r1' ? stage0Info?.rootId : activeStage1Info?.rootId;
  const maxPoints = activeStage === 'r1' ? R1_MAX : R2_MAX;

  const r1Used = useMemo(() => countCost(r1EnabledIds, nodesById), [r1EnabledIds, nodesById]);
  const r2Used = useMemo(
    () => countCost(effectiveR2EnabledIds, nodesById),
    [effectiveR2EnabledIds, nodesById],
  );
  const usedPoints = activeStage === 'r1' ? r1Used : r2Used;
  // R1+R2 合計消費ポイント（Unlock 条件 type=3 の判定に使用）
  const totalUsed = r1Used + r2Used;
  const isUnlockMet = useCallback(
    (node: TreeNode) => !node.unlock?.some(([type, val]) => type === 3 && totalUsed < val),
    [totalUsed],
  );

  // ホバーパス
  const hoveredId = hoveredNodeInfo?.node.id ?? null;

  const stageFilter = useCallback(
    (n: TreeNode) =>
      activeStage === 'r1' ? n.stage === 0 : n.stage === 1 && n.bdType === activeBdType,
    [activeStage, activeBdType],
  );

  const hoverPath = useMemo(() => {
    if (hoveredId == null) return null;
    if (enabledIds.has(hoveredId)) return null;
    const hovNode = nodesById.get(hoveredId);
    if (hovNode && !isUnlockMet(hovNode)) return null;
    return findEffectivePath(hoveredId, enabledIds, nodesById, stageFilter);
  }, [hoveredId, enabledIds, nodesById, stageFilter, isUnlockMet]);

  const hoverPathSet = useMemo(
    () => (hoverPath ? new Set(hoverPath) : new Set<number>()),
    [hoverPath],
  );

  // 表示ノード
  const visibleNodes = useMemo(
    () =>
      activeStage === 'r1'
        ? allNodes.filter((n) => n.stage === 0)
        : allNodes.filter((n) => n.stage === 1 && n.bdType === activeBdType),
    [activeStage, allNodes, activeBdType],
  );

  // SVGスケール
  const { minX, minY, baseScale } = useMemo(() => {
    if (visibleNodes.length === 0) return { minX: 0, minY: 0, baseScale: 0.15 };
    const xs = visibleNodes.map((n) => n.position[0]);
    const ys = visibleNodes.map((n) => n.position[1]);
    const lo = Math.min(...xs);
    const top = Math.min(...ys);
    const rangeX = Math.max(...xs) - lo;
    const s = Math.min(Math.max(700 / (rangeX + 1), 0.12), 0.55);
    return { minX: lo, minY: top, baseScale: s };
  }, [visibleNodes]);

  const finalScale = baseScale * zoomLevel;

  const { svgW, svgH } = useMemo(() => {
    if (visibleNodes.length === 0) return { svgW: 300, svgH: 300 };
    const xs = visibleNodes.map((n) => n.position[0]);
    const ys = visibleNodes.map((n) => n.position[1]);
    return {
      svgW: (Math.max(...xs) - Math.min(...xs)) * finalScale + PADDING * 2,
      svgH: (Math.max(...ys) - Math.min(...ys)) * finalScale + PADDING * 2,
    };
  }, [visibleNodes, finalScale]);

  const nr = Math.max(6, Math.min(BASE_NR + 3, finalScale * 35));

  const tx = useCallback((x: number) => (x - minX) * finalScale + PADDING, [minX, finalScale]);
  const ty = useCallback((y: number) => (y - minY) * finalScale + PADDING, [minY, finalScale]);

  const reachable = useMemo(
    () => (rootId != null ? bfsReachable(enabledIds, nodesById, rootId) : new Set<number>()),
    [enabledIds, nodesById, rootId],
  );

  // ---- 背景 ----
  const bgLeftUrl = getBgUrl(wt, 'left');
  const bgRightUrl = getBgUrl(wt, 'right');
  const scrollStyle: React.CSSProperties = (() => {
    const topColor = roleTheme.bgTint.replace(/[\d.]+\)$/, '0.9)');
    const bottomColor = roleTheme.bgTint;
    return {
      backgroundImage: `linear-gradient(to bottom, ${topColor}, ${bottomColor})`,
      backgroundPosition: '0 0',
      backgroundSize: '100% 100%',
      backgroundRepeat: 'no-repeat',
    };
  })();

  // ---- ハンドラ ----

  const doSwitchBdType = useCallback(
    (newBdType: 0 | 1) => {
      // R2 リセットは onSelectProfessionType 経由で親 useBuildState が担当
      setActiveBdType(newBdType);
      onSelectProfessionType(newBdType === 0 ? 'type1' : 'type2');
    },
    [onSelectProfessionType],
  );

  const doR1Deselect = useCallback(
    (nodeId: number) => {
      const r1Root = stage0Info?.rootId;
      if (r1Root == null) return;
      const next = new Set(r1EnabledIds);
      next.delete(nodeId);
      const afterReach = bfsReachable(next, nodesById, r1Root);
      for (const id of [...next]) {
        if (!afterReach.has(id)) next.delete(id);
      }
      setR1EnabledIds(next);
      const r2Root = activeStage1Info?.rootId;
      setR2EnabledIds(r2Root != null ? new Set([r2Root]) : new Set());
    },
    [stage0Info, r1EnabledIds, nodesById, activeStage1Info],
  );

  const handleSwitchBdType = useCallback(
    (newBdType: 0 | 1) => {
      if (newBdType === activeBdType) return;
      const currentRoot = activeStage1Info?.rootId;
      const hasNonRoot = [...r2EnabledIds].some((id) => id !== currentRoot);
      if (hasNonRoot) {
        setPendingSwitchBdType(newBdType);
        return;
      }
      doSwitchBdType(newBdType);
    },
    [activeBdType, activeStage1Info, r2EnabledIds, doSwitchBdType],
  );

  const handleNodeClick = useCallback(
    (nodeId: number) => {
      if (rootId == null) return;
      if (activeStage === 'r2' && !r1Full) return;
      const node = nodesById.get(nodeId);
      if (!node) return;
      if (!enabledIds.has(nodeId) && !isUnlockMet(node)) return;

      if (enabledIds.has(nodeId)) {
        // R1 デセレクト: R2 にルート以外のノードがあれば確認ダイアログを表示
        if (activeStage === 'r1') {
          const r2Root = activeStage1Info?.rootId;
          const hasNonRootR2 =
            r2Root != null ? [...r2EnabledIds].some((id) => id !== r2Root) : r2EnabledIds.size > 0;
          if (hasNonRootR2) {
            setPendingR1Deselect(nodeId);
            return;
          }
          // R2 が空またはルートのみの場合はそのまま R1 をデセレクト
          const r1Root = stage0Info?.rootId ?? rootId;
          const next = new Set(r1EnabledIds);
          next.delete(nodeId);
          const afterReach = bfsReachable(next, nodesById, r1Root);
          for (const id of [...next]) {
            if (!afterReach.has(id)) next.delete(id);
          }
          setR1EnabledIds(next);
          return;
        }

        // R2 デセレクト: totalUsed が下がることで B 群のアンロック条件が外れる場合にカスケード
        const r2Root = activeStage1Info?.rootId;
        const next = new Set(r2EnabledIds);
        next.delete(nodeId);
        const afterReach = bfsReachable(next, nodesById, rootId);
        for (const id of [...next]) {
          if (!afterReach.has(id)) next.delete(id);
        }

        if (r2Root != null) {
          let cascadeChanged = true;
          let cascadeTotal = r1Used + countCost(next, nodesById);
          while (cascadeChanged) {
            cascadeChanged = false;
            // R2 ルートは unlock 条件があっても r1Full で保証されるため除外。
            // それ以外の条件付きノード(B群)と子孫(C群)を集めて A群合計を算出し、
            // 各 B 群ノードの閾値と比較する。こうすることで兄弟 B 群が互いの
            // コストを補い合う誤判定を防ぎつつ、ルート除外で過剰除去も防ぐ。
            const allBCSet = new Set<number>();
            for (const cid of next) {
              if (cid === r2Root) continue;
              const cn = nodesById.get(cid);
              if (!cn?.unlock?.some(([t]) => t === 3)) continue;
              for (const id of getSubtreeInSet(cid, next, nodesById)) allBCSet.add(id);
            }
            const aTotal = cascadeTotal - countCost(allBCSet, nodesById);
            for (const cid of [...next]) {
              if (cid === r2Root) continue;
              const cn = nodesById.get(cid);
              if (!cn?.unlock?.length) continue;
              const fails = cn.unlock.some(([type, val]) => type === 3 && aTotal < val);
              if (fails) {
                next.delete(cid);
                const reach2 = bfsReachable(next, nodesById, r2Root);
                for (const rid of [...next]) {
                  if (!reach2.has(rid)) next.delete(rid);
                }
                cascadeTotal = r1Used + countCost(next, nodesById);
                cascadeChanged = true;
                break;
              }
            }
          }
        }

        setR2EnabledIds(next);
        return;
      }

      // 先行ノードなし（ルート等）は経路探索不要で直接有効化
      if (node.preNodes.length === 0) {
        const tdRoot = talentTree.nodes[String(node.talentId)];
        const rootCost = tdRoot?.cost ?? 0;
        if (usedPoints + rootCost <= maxPoints) {
          const next = new Set(enabledIds);
          next.add(nodeId);
          setEnabledIds(next);
        }
        return;
      }

      // ホバーパスが有効ならそのパスを全選択
      if (hoverPath !== null) {
        const unenabled = hoverPath.filter((id) => !enabledIds.has(id));
        const pathCost = unenabled.reduce((sum, id) => {
          const n = nodesById.get(id);
          const td = n ? talentTree.nodes[String(n.talentId)] : undefined;
          return sum + (td?.cost ?? 0);
        }, 0);
        if (usedPoints + pathCost <= maxPoints) {
          const next = new Set(enabledIds);
          for (const id of unenabled) next.add(id);
          setEnabledIds(next);
        }
      }
      // hoverPath === null の場合はクリック無効 (複数経路)
    },
    [
      rootId,
      nodesById,
      enabledIds,
      activeStage,
      usedPoints,
      maxPoints,
      setEnabledIds,
      hoverPath,
      r1Used,
      activeStage1Info,
      r2EnabledIds,
      stage0Info,
      r1EnabledIds,
      r1Full,
    ],
  );

  const handleRecommend = useCallback(() => {
    if (activeStage === 'r1') {
      if (!stage0Info?.recommendTalent?.length) return;
      setR1EnabledIds(new Set<number>(stage0Info.recommendTalent));
    } else {
      if (!activeStage1Info?.recommendTalent?.length) return;
      setR2EnabledIds(new Set<number>(activeStage1Info.recommendTalent));
      if (stage0Info?.recommendTalent?.length) {
        setR1EnabledIds(new Set<number>(stage0Info.recommendTalent));
      }
    }
  }, [activeStage, stage0Info, activeStage1Info]);

  const doReset = useCallback(() => {
    setR1EnabledIds(new Set());
    setR2EnabledIds(new Set());
  }, [setR1EnabledIds, setR2EnabledIds]);

  const handleReset = useCallback(() => {
    const r2Root = activeStage1Info?.rootId;
    const hasNonRootR2 =
      r2Root != null ? [...r2EnabledIds].some((id) => id !== r2Root) : r2EnabledIds.size > 0;
    if (hasNonRootR2) {
      setPendingReset(true);
      return;
    }
    doReset();
  }, [activeStage1Info, r2EnabledIds, doReset]);

  const stage1Info0 = stage1Infos.find((s) => s.bdType === 0);
  const stage1Info1 = stage1Infos.find((s) => s.bdType === 1);
  const type1Label = stage1Info0
    ? t(`talentStages.${stage1Info0.id}.typeName`, { defaultValue: '型1' })
    : '型1';
  const type2Label = stage1Info1
    ? t(`talentStages.${stage1Info1.id}.typeName`, { defaultValue: '型2' })
    : '型2';
  const r1LabelFallback = tUi('buildPlanner.talentTree.r1Label', { defaultValue: 'Expertise I' });
  const r1StageLabel = stage0Info
    ? t(`talentStages.${stage0Info.id}.stageName`, { defaultValue: r1LabelFallback })
    : r1LabelFallback;
  const r2StageLabel = activeStage1Info
    ? t(`talentStages.${activeStage1Info.id}.stageName`, { defaultValue: 'R2' })
    : 'R2';

  if (allNodes.length === 0) {
    return (
      <div className="talent-tree-panel talent-tree-panel--empty">
        {tUi('buildPlanner.comingSoon')}
      </div>
    );
  }

  return (
    <div className="talent-tree-panel">
      {/* ヘッダーバー */}
      <div className="talent-tree-panel__bar">
        <div className="talent-tree-panel__stage-group">
          <button
            type="button"
            className={`talent-tree-panel__stage-btn${activeStage === 'r1' ? ' talent-tree-panel__stage-btn--active' : ''}`}
            onClick={() => setActiveStage('r1')}
          >
            {r1StageLabel}: {r1Used}/{R1_MAX}
          </button>
          <span className="talent-tree-panel__sep">|</span>
          <button
            type="button"
            className={`talent-tree-panel__stage-btn${activeStage === 'r2' ? ' talent-tree-panel__stage-btn--active' : ''}`}
            onClick={() => setActiveStage('r2')}
          >
            {r2StageLabel}: {r2Used}/{R2_MAX}
          </button>
          <button
            type="button"
            className={`talent-tree-panel__type-btn${activeBdType === 0 ? ' talent-tree-panel__type-btn--active' : ''}`}
            onClick={() => handleSwitchBdType(0)}
          >
            {type1Label}
          </button>
          <button
            type="button"
            className={`talent-tree-panel__type-btn${activeBdType === 1 ? ' talent-tree-panel__type-btn--active' : ''}`}
            onClick={() => handleSwitchBdType(1)}
          >
            {type2Label}
          </button>
        </div>
        <div className="talent-tree-panel__actions">
          <button type="button" className="talent-tree-panel__recommend" onClick={handleRecommend}>
            {tUi('buildPlanner.talentTree.recommend')}
          </button>
          <button type="button" className="talent-tree-panel__reset" onClick={handleReset}>
            {tUi('buildPlanner.talentTree.reset')}
          </button>
          <div className="talent-tree-panel__zoom">
            <button
              type="button"
              className="talent-tree-panel__zoom-btn"
              onClick={() => setZoomLevel((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(1)))}
              disabled={zoomLevel <= ZOOM_MIN}
            >
              −
            </button>
            <button
              type="button"
              className="talent-tree-panel__zoom-pct"
              onClick={() => setZoomLevel(1.0)}
              title={tUi('buildPlanner.talentTree.resetTooltip')}
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              type="button"
              className="talent-tree-panel__zoom-btn"
              onClick={() => setZoomLevel((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(1)))}
              disabled={zoomLevel >= ZOOM_MAX}
            >
              ＋
            </button>
          </div>
        </div>
      </div>

      {/* SVGキャンバス + バッジのラッパー（position:relative の基準） */}
      <div
        className="talent-tree-panel__canvas-wrapper"
        style={{ backgroundColor: roleTheme.bgColor }}
        ref={canvasWrapperRef}
      >
        {bgLeftUrl && (
          <div
            className="talent-tree-panel__bg-side talent-tree-panel__bg-side--left"
            style={{ backgroundImage: `url(${bgLeftUrl})` }}
          />
        )}
        {bgRightUrl && (
          <div
            className="talent-tree-panel__bg-side talent-tree-panel__bg-side--right"
            style={{ backgroundImage: `url(${bgRightUrl})` }}
          />
        )}
        <div className="talent-tree-panel__glow-overlay" />
        <div
          className="talent-tree-panel__scroll"
          style={scrollStyle}
          onMouseLeave={scheduleTooltipClose}
        >
          <svg width={svgW} height={svgH} className="talent-tree-panel__svg">
            <defs>
              {visibleNodes.map((node) => {
                const nx = tx(node.position[0]);
                const ny = ty(node.position[1]);
                const isRoot = node.id === rootId;
                const isR2Root = isRoot && activeStage === 'r2';
                const td = talentTree.nodes[String(node.talentId)];
                const type = td?.type ?? 1;
                const nodeR =
                  isR2Root || type === 4 || type === 5 ? nr * 2.3 : Math.round(nr * 1.3);
                const shapeR = isR2Root ? nr * 2.6 : nodeR;
                return isR2Root ? (
                  <clipPath key={`cp${node.id}`} id={`cp${node.id}`}>
                    <polygon points={hexPoints(nx, ny, shapeR)} />
                  </clipPath>
                ) : (
                  <clipPath key={`cp${node.id}`} id={`cp${node.id}`}>
                    <circle cx={nx} cy={ny} r={nodeR} />
                  </clipPath>
                );
              })}
            </defs>

            {/* エッジ */}
            {visibleNodes.flatMap((node) => {
              const nx = tx(node.position[0]);
              const ny = ty(node.position[1]);
              const nodeEnabled = enabledIds.has(node.id);
              return node.nextNodes.map((nxtId) => {
                const nxt = nodesById.get(nxtId);
                if (!nxt || nxt.stage !== node.stage || nxt.bdType !== node.bdType) return null;
                const nxtEnabled = enabledIds.has(nxtId);
                const bothEnabled = nodeEnabled && nxtEnabled;
                const inHoverPath =
                  hoverPathSet.has(node.id) &&
                  hoverPathSet.has(nxtId) &&
                  (!nodeEnabled || !nxtEnabled);
                return (
                  <line
                    key={`e${node.id}-${nxtId}`}
                    x1={nx}
                    y1={ny}
                    x2={tx(nxt.position[0])}
                    y2={ty(nxt.position[1])}
                    stroke={
                      bothEnabled || inHoverPath ? roleTheme.edgeColor : 'rgba(255,255,255,0.13)'
                    }
                    strokeWidth={inHoverPath ? 2.5 : bothEnabled ? 2 : 1}
                    opacity={inHoverPath ? 0.8 : 1}
                  />
                );
              });
            })}

            {/* ノード */}
            {visibleNodes.map((node) => {
              const nx = tx(node.position[0]);
              const ny = ty(node.position[1]);
              const isEnabled = enabledIds.has(node.id);
              const isRoot = node.id === rootId;
              const isR2Root = isRoot && activeStage === 'r2';
              const td = talentTree.nodes[String(node.talentId)];
              const type = td?.type ?? 1;
              const name = t(`talents.${node.talentId}.name`, {
                defaultValue: `#${node.talentId}`,
              });
              const desc = t(`talents.${node.talentId}.description`, { defaultValue: '' });
              const iconUrl = getTalentIconUrl(td?.icon ?? '');

              const nodeR = isR2Root || type === 4 || type === 5 ? nr * 2.3 : Math.round(nr * 1.3);
              const shapeR = isR2Root ? nr * 2.6 : nodeR;
              const iconR =
                isR2Root || type === 4 || type === 5
                  ? Math.round(nodeR * 0.82)
                  : Math.round(nodeR * 0.65);
              const hasCustomIcon = (type === 4 || type === 5) && !!iconUrl;
              const showRoleBg =
                (hasCustomIcon && !!roleBgIconUrl) || (isR2Root && !!genreBgIconUrl);
              const bgUrl = isR2Root ? genreBgIconUrl : roleBgIconUrl;
              const bgR = isR2Root ? nodeR * 1.2 : nodeR;

              const unlockMet = isUnlockMet(node);
              const unlockRequired = node.unlock?.find((u) => u[0] === 3)?.[1] ?? null;

              const canActivate =
                !isEnabled &&
                unlockMet &&
                (activeStage === 'r1' || r1Full) &&
                (() => {
                  const cost = td?.cost ?? 0;
                  if (usedPoints + cost > maxPoints) return false;
                  if (node.preNodes.length === 0) return true;
                  return node.preNodes.some((p) => reachable.has(p));
                })();

              const isHoveredNode = node.id === hoveredId;
              const isUnlockBlocked = !isEnabled && !unlockMet;
              const isHoverTarget =
                isHoveredNode &&
                !isEnabled &&
                unlockMet &&
                (hoverPath !== null || (node.preNodes.length === 0 && canActivate));
              const isHoverBlocked =
                isHoveredNode && !isEnabled && hoverPath === null && !canActivate;

              let fill: string;
              let stroke: string;
              let sw: number;

              const isHoverEnabled = isHoveredNode && isEnabled;
              if (isEnabled) {
                fill = showRoleBg ? 'rgba(0,0,0,0)' : roleTheme.fillColor;
                if (isHoverEnabled) {
                  stroke = 'rgba(255,255,255,0.9)';
                  sw = 2.5;
                } else if (!showRoleBg) {
                  stroke = 'rgba(255,255,255,0.55)';
                  sw = 1;
                } else {
                  stroke = 'none';
                  sw = 0;
                }
              } else if (isHoverTarget) {
                fill = showRoleBg ? 'rgba(0,0,0,0)' : 'rgba(22,22,34,0.95)';
                stroke = '#ffffff';
                sw = 3;
              } else if (isUnlockBlocked) {
                fill = showRoleBg ? 'rgba(0,0,0,0)' : 'rgba(16,12,6,0.55)';
                stroke = 'none';
                sw = 0;
              } else if (canActivate) {
                fill = showRoleBg ? 'rgba(0,0,0,0)' : 'rgba(18,18,28,0.92)';
                stroke = 'none';
                sw = 0;
              } else {
                fill = showRoleBg ? 'rgba(0,0,0,0)' : 'rgba(10,10,18,0.55)';
                stroke = 'none';
                sw = 0;
              }

              // 小ノードは状態によらず最細ボーダーを常時表示
              if (!showRoleBg && sw === 0) {
                stroke = 'rgba(255,255,255,0.2)';
                sw = 1;
              }
              // R2Root はポイント時より細い枠線を常時表示
              if (isR2Root && sw === 0) {
                stroke = 'rgba(255,255,255,0.7)';
                sw = 2;
              }

              const cursor =
                activeStage === 'r2' && !r1Full
                  ? 'not-allowed'
                  : isHoverBlocked || isUnlockBlocked
                    ? 'not-allowed'
                    : 'pointer';

              return (
                <g
                  key={`n${node.id}`}
                  onClick={() => handleNodeClick(node.id)}
                  onMouseEnter={(e) => {
                    cancelTooltipClose();
                    const rect = (e.currentTarget as SVGGElement).getBoundingClientRect();
                    setHoveredNodeInfo({
                      node,
                      td,
                      name,
                      desc,
                      unlockRequired,
                      x: rect.right + 10,
                      y: rect.top,
                    });
                  }}
                  onMouseLeave={scheduleTooltipClose}
                  style={{ cursor }}
                >
                  {isR2Root ? (
                    <polygon
                      points={hexPoints(nx, ny, shapeR)}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={sw}
                    />
                  ) : (
                    <circle
                      cx={nx}
                      cy={ny}
                      r={nodeR}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={sw}
                    />
                  )}

                  {showRoleBg && (
                    <image
                      href={bgUrl!}
                      x={nx - bgR}
                      y={ny - bgR}
                      width={bgR * 2}
                      height={bgR * 2}
                      clipPath={`url(#cp${node.id})`}
                      opacity={isEnabled ? 1 : isUnlockBlocked ? 0.15 : 0.35}
                      preserveAspectRatio="xMidYMid slice"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}

                  {iconUrl && (
                    <image
                      href={iconUrl}
                      x={nx - iconR}
                      y={ny - iconR}
                      width={iconR * 2}
                      height={iconR * 2}
                      clipPath={`url(#cp${node.id})`}
                      opacity={isEnabled ? 1 : isUnlockBlocked ? 0.18 : 0.28}
                      preserveAspectRatio="xMidYMid meet"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}

                  {type === 5 && !iconUrl && (
                    <polygon
                      points={`${nx},${ny - nodeR * 0.55} ${nx + nodeR * 0.45},${ny} ${nx},${ny + nodeR * 0.55} ${nx - nodeR * 0.45},${ny}`}
                      fill={isEnabled ? '#c4b5fd' : '#4c3870'}
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* ポイントバッジ — ラッパー基準で左上固定、スクロールに追従しない */}
        <div className="talent-tree-panel__points-badge">
          <div
            className="talent-tree-panel__points-pill"
            title={t('uiLabels.talentPoints', { defaultValue: 'Talent Points' })}
          >
            {residueIconUrl && (
              <img src={residueIconUrl} className="talent-tree-panel__points-icon" alt="" />
            )}
            <span className="talent-tree-panel__points-value">{totalUsed}/70</span>
          </div>
        </div>
      </div>

      {/* ツールチップ */}
      {hoveredNodeInfo && (
        <FloatingTooltip
          x={hoveredNodeInfo.x}
          y={hoveredNodeInfo.y}
          className="talent-tree-panel__tooltip"
          onMouseEnter={cancelTooltipClose}
          onMouseLeave={scheduleTooltipClose}
        >
          <div className="talent-tree-panel__tooltip-header">
            {getTalentIconUrl(hoveredNodeInfo.td?.icon ?? '') && (
              <img
                className="talent-tree-panel__tooltip-icon"
                src={getTalentIconUrl(hoveredNodeInfo.td?.icon ?? '')}
                alt=""
              />
            )}
            <span className="talent-tree-panel__tooltip-name">{hoveredNodeInfo.name}</span>
          </div>
          {hoveredNodeInfo.unlockRequired != null && totalUsed < hoveredNodeInfo.unlockRequired && (
            <p className="talent-tree-panel__tooltip-unlock">
              {tUi('buildPlanner.talentTree.unlockAtPoints', {
                required: hoveredNodeInfo.unlockRequired,
                current: totalUsed,
              })}
            </p>
          )}
          {hoveredNodeInfo.desc && (
            <p className="talent-tree-panel__tooltip-desc">{renderMarkup(hoveredNodeInfo.desc)}</p>
          )}
        </FloatingTooltip>
      )}

      {/* 型切替確認ダイアログ */}
      {pendingSwitchBdType !== null && (
        <ConfirmDialog
          message={tUi('buildPlanner.talentTree.confirmTypeChangeMsg')}
          confirmLabel={tUi('buildPlanner.talentTree.confirmTypeChangeYes')}
          onConfirm={() => {
            doSwitchBdType(pendingSwitchBdType);
            setPendingSwitchBdType(null);
          }}
          cancelLabel={tUi('buildPlanner.talentTree.confirmTypeChangeCancel')}
          onCancel={() => setPendingSwitchBdType(null)}
        />
      )}

      {/* R1 スキル解除確認ダイアログ */}
      {pendingR1Deselect !== null && (
        <ConfirmDialog
          message={tUi('buildPlanner.talentTree.confirmR1DeselectMsg')}
          confirmLabel={tUi('buildPlanner.talentTree.confirmR1DeselectYes')}
          onConfirm={() => {
            doR1Deselect(pendingR1Deselect);
            setPendingR1Deselect(null);
          }}
          cancelLabel={tUi('buildPlanner.talentTree.confirmR1DeselectCancel')}
          onCancel={() => setPendingR1Deselect(null)}
        />
      )}

      {/* リセット確認ダイアログ */}
      {pendingReset && (
        <ConfirmDialog
          message={tUi('buildPlanner.talentTree.confirmResetMsg')}
          confirmLabel={tUi('buildPlanner.talentTree.confirmResetYes')}
          onConfirm={() => {
            doReset();
            setPendingReset(false);
          }}
          cancelLabel={tUi('buildPlanner.talentTree.confirmResetCancel')}
          onCancel={() => setPendingReset(false)}
        />
      )}
    </div>
  );
}
