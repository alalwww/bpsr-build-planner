import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import './talent.css';
import { renderMarkup } from '../components/renderMarkup';
import ConfirmDialog from '../components/ConfirmDialog';
import FloatingTooltip from '../components/FloatingTooltip';
import LinkTextPopup from '../components/LinkTextPopup';
import ZoomControls from '../components/ZoomControls';
import { useAnchorTooltip } from '../components/useAnchorTooltip';
import { CURSOR_TOOLTIP_GAP } from '../components/useCursorTooltip';
import { useLinkTextPopup } from '../components/useLinkTextPopup';
import { useCtrlWheelZoom } from '../components/useCtrlWheelZoom';
import { useDragScroll } from '../components/useDragScroll';
import { useSessionState } from '../components/useSessionState';
import type { ProfessionKey, ProfessionTypeKey } from '../profession';
import { PROFESSIONS } from '../profession';
import { useBuildStore } from '../store/useBuildStore';
import { getClassData } from '../classData';
import {
  DEFAULT_ROLE_THEME,
  getBgUrl,
  getTalentAsset,
  getTalentIconUrl,
  ROLE_ICON_NAMES,
  ROLE_THEMES,
  type StageInfo,
  type TalentNodeData,
  talentTree,
  type TreeNode,
} from './talentTreeData';
import {
  bfsReachable,
  countCost,
  deselectNodeAndPrune,
  deselectR2NodeWithCascade,
  findEffectivePath,
  hexPoints,
  nodeShapeRadii,
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
  x: number; // tooltip position (マウスカーソルのclientX ± CURSOR_TOOLTIP_GAP)
  y: number; // tooltip position (マウスカーソルのclientY)
  align: 'left' | 'right'; // カーソルがキャンバス中央より右なら'left'(左に表示)、左なら'right'
  pinned: boolean;
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

  const talentRole = getClassData(wt)?.talent ?? 1;
  const roleTheme = ROLE_THEMES[talentRole] ?? DEFAULT_ROLE_THEME;
  const roleBgIconUrl = getTalentAsset(ROLE_ICON_NAMES[talentRole] ?? '');
  const genreBgIconUrl = getTalentAsset('talent_icon_genre');
  const residueIconUrl = getTalentAsset('talent_icon_residue');

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
  const {
    zoom: zoomLevel,
    setZoom: setZoomLevel,
    ref: canvasWrapperRef,
  } = useCtrlWheelZoom({ min: ZOOM_MIN, max: ZOOM_MAX, step: ZOOM_STEP });
  // 背景ドラッグでのスクロール。ズームrefとは別要素(実際にoverflow:autoでスクロールする
  // .talent-tree-panel__scroll)に付ける。
  const { ref: scrollDragRef } = useDragScroll('.talent-tree-panel__node');
  const {
    tooltip: hoveredNodeInfo,
    open: openNodeTooltip,
    openImmediate: openNodeTooltipImmediate,
    cancelClose: cancelTooltipClose,
    scheduleClose: scheduleTooltipClose,
    close: closeNodeTooltip,
  } = useAnchorTooltip<HoveredNodeInfo>(500, (a, b) => a.node.id === b.node.id); // 別ノードへの切り替えは一旦閉じて0.5秒待たせるhover intent
  const linkTextPopup = useLinkTextPopup();
  // アビリティツリーの誤操作防止ロック。既定はOFF(編集中)。セッション中(ページを開いている
  // 間)は維持するがlocalStorageには永続化しない。ロック中はノードクリックでの取得/解除を
  // 無効化し、代わりにシングルクリックでツールチップを固定できるようにする。
  const [locked, setLocked] = useSessionState('talentTree.locked', false);
  const isPinned = locked && (hoveredNodeInfo?.pinned ?? false);
  const [pendingSwitchBdType, setPendingSwitchBdType] = useState<0 | 1 | null>(null);
  const [pendingR1Deselect, setPendingR1Deselect] = useState<number | null>(null);
  const [pendingReset, setPendingReset] = useState(false);
  const [pendingRecommend, setPendingRecommend] = useState(false);

  // professionTypeKey が変化したとき activeBdType を同期（プランロード時も含む）
  useEffect(() => {
    setActiveBdType(professionTypeKey === 'type1' ? 0 : 1);
  }, [professionTypeKey]);

  // professionKey が変わったらダイアログ状態をリセット
  useEffect(() => {
    setPendingSwitchBdType(null);
    setPendingR1Deselect(null);
    setPendingReset(false);
    setPendingRecommend(false);
  }, [professionKey]);

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

  // 全ポイント取得済み(R1・R2とも上限)の状態でアビリティツリーから別パネルへ移動した
  // (=アンマウントされた)場合、編集は完了したものとみなし、次回開いたときの既定を
  // ロック中にする。マウント中の値変化のたびではなく、真のアンマウント時のみ判定したい
  // ためrefで最新値を保持し、effect自体は空配列依存にする。
  const pointsFullRef = useRef(false);
  pointsFullRef.current = r1Used === R1_MAX && r2Used === R2_MAX;
  useEffect(() => {
    return () => {
      if (pointsFullRef.current) setLocked(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const usedPoints = activeStage === 'r1' ? r1Used : r2Used;
  // R1+R2 合計消費ポイント（Unlock 条件 type=3 の判定に使用）
  const totalUsed = r1Used + r2Used;
  const isUnlockMet = useCallback(
    (node: TreeNode) => !node.unlock?.some(([type, val]) => type === 3 && totalUsed < val),
    [totalUsed],
  );

  // ホバーパス。カーソル形状/選択可能ハイライト/経路プレビュー用の「実際に今ホバーしている
  // ノード」。ツールチップ表示用のhoveredNodeInfo(0.5秒のhover intentで遅延する)とは
  // 別管理にし、こちらは実際のマウス位置に即座に追従させる。
  const [trueHoveredId, setTrueHoveredId] = useState<number | null>(null);
  const hoveredId = trueHoveredId;

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
    const path = findEffectivePath(hoveredId, enabledIds, nodesById, stageFilter, isUnlockMet);
    if (path == null) return null;
    // 経路上の未取得ノードの合計消費ポイントが残りポイントを超える場合、実際には
    // クリックしても取得できない(handleNodeClickの判定と同じ)ため、ハイライトも出さない。
    const pathCost = path
      .filter((id) => !enabledIds.has(id))
      .reduce((sum, id) => {
        const n = nodesById.get(id);
        const td = n ? talentTree.nodes[String(n.talentId)] : undefined;
        return sum + (td?.cost ?? 0);
      }, 0);
    if (usedPoints + pathCost > maxPoints) return null;
    return path;
  }, [hoveredId, enabledIds, nodesById, stageFilter, isUnlockMet, usedPoints, maxPoints]);

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
  // ロール(1:攻撃/2:支援/3:防御) ごとのシーン背景(virtual_scene_bg_3/4/5.png)。
  // スクロール(.talent-tree-panel__scroll)に直接背景指定するとbackground-attachment
  // の既定値(scroll)によりビューポート基準で固定され、中身のスクロールに追従しない。
  const roleBgUrl = getTalentAsset(`virtual_scene_bg_${talentRole + 2}`);
  const scrollStyle: React.CSSProperties = {
    backgroundImage: roleBgUrl ? `url(${roleBgUrl})` : undefined,
  };

  // ---- ハンドラ ----

  const doSwitchBdType = useCallback(
    (newBdType: 0 | 1) => {
      // R2 リセットは onSelectProfessionType 経由で親 useBuildState が担当
      setActiveBdType(newBdType);
      onSelectProfessionType(newBdType === 0 ? 'type1' : 'type2');
      setLocked(false);
    },
    [onSelectProfessionType, setLocked],
  );

  const doR1Deselect = useCallback(
    (nodeId: number) => {
      const r1Root = stage0Info?.rootId;
      if (r1Root == null) return;
      setR1EnabledIds(deselectNodeAndPrune(r1EnabledIds, nodeId, nodesById, r1Root));
      const r2Root = activeStage1Info?.rootId;
      setR2EnabledIds(r2Root != null ? new Set([r2Root]) : new Set());
    },
    [stage0Info, r1EnabledIds, nodesById, activeStage1Info, setR1EnabledIds, setR2EnabledIds],
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
          setR1EnabledIds(deselectNodeAndPrune(r1EnabledIds, nodeId, nodesById, r1Root));
          return;
        }

        // R2 デセレクト: totalUsed が下がることで B 群のアンロック条件が外れる場合にカスケード
        setR2EnabledIds(deselectR2NodeWithCascade(r2EnabledIds, nodeId, nodesById, rootId, r1Used));
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
      isUnlockMet,
      setR1EnabledIds,
      setR2EnabledIds,
    ],
  );

  const doRecommend = useCallback(() => {
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
    setLocked(false);
  }, [activeStage, stage0Info, activeStage1Info, setR1EnabledIds, setR2EnabledIds, setLocked]);

  const handleRecommend = useCallback(() => {
    const r2Root = activeStage1Info?.rootId;
    const hasNonRootR2 =
      r2Root != null ? [...r2EnabledIds].some((id) => id !== r2Root) : r2EnabledIds.size > 0;
    if (r1EnabledIds.size > 0 || hasNonRootR2) {
      setPendingRecommend(true);
      return;
    }
    doRecommend();
  }, [activeStage1Info, r1EnabledIds, r2EnabledIds, doRecommend]);

  const doReset = useCallback(() => {
    setR1EnabledIds(new Set());
    setR2EnabledIds(new Set());
    setLocked(false);
  }, [setR1EnabledIds, setR2EnabledIds, setLocked]);

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
          <button
            type="button"
            className={`talent-tree-panel__lock-toggle${locked ? ' talent-tree-panel__lock-toggle--locked' : ''}`}
            onClick={() => setLocked((v) => !v)}
          >
            <span className="talent-tree-panel__lock-toggle-status">
              {tUi(
                locked
                  ? 'buildPlanner.talentTree.lockToggleLocked'
                  : 'buildPlanner.talentTree.lockToggleEditing',
              )}
            </span>
            <span className="talent-tree-panel__lock-toggle-action">
              {tUi(
                locked
                  ? 'buildPlanner.talentTree.lockToggleUnlockAction'
                  : 'buildPlanner.talentTree.lockToggleLockAction',
              )}
            </span>
          </button>
          <button type="button" className="talent-tree-panel__recommend" onClick={handleRecommend}>
            {tUi('buildPlanner.talentTree.recommend')}
          </button>
          <button type="button" className="talent-tree-panel__reset" onClick={handleReset}>
            {tUi('buildPlanner.talentTree.reset')}
          </button>
          <ZoomControls
            zoom={zoomLevel}
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={ZOOM_STEP}
            onChange={setZoomLevel}
            resetTitle={tUi('buildPlanner.talentTree.resetTooltip')}
            className="talent-tree-panel__zoom"
            buttonClassName="talent-tree-panel__zoom-btn"
            percentClassName="talent-tree-panel__zoom-pct"
          />
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
          onMouseLeave={() => {
            setTrueHoveredId(null);
            if (!isPinned) scheduleTooltipClose();
          }}
          ref={scrollDragRef}
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
                const { nodeR, shapeR } = nodeShapeRadii(nr, type, isR2Root);
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

              const { nodeR, shapeR } = nodeShapeRadii(nr, type, isR2Root);
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
              // ロック中は選択可否に関わらず、ツールチップの対象(実際に表示されている
              // ノード)であることだけを示すボーダーを表示する(誤操作防止モードでは
              // 選択判定自体が意味を持たないため)。ツールチップの表示タイミング
              // (0.5秒のhover intent、または固定表示)に同期させるため、実ホバーの
              // isHoveredNodeではなくhoveredNodeInfo(ツールチップ側の状態)を直接見る。
              const isLockedTooltipTarget = locked && hoveredNodeInfo?.node.id === node.id;
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
                if (isHoverEnabled || isLockedTooltipTarget) {
                  stroke = 'rgba(255,255,255,0.9)';
                  sw = 2.5;
                } else if (!showRoleBg) {
                  stroke = 'rgba(255,255,255,0.55)';
                  sw = 1;
                } else {
                  stroke = 'none';
                  sw = 0;
                }
              } else if (isHoverTarget || isLockedTooltipTarget) {
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

              // ロック中はクリックの意味が「ツールチップ固定」のみになり、取得可否に関する
              // 制約は関係ないため、常にpointerでよい。
              const cursor = locked
                ? 'pointer'
                : activeStage === 'r2' && !r1Full
                  ? 'not-allowed'
                  : isHoverBlocked || isUnlockBlocked
                    ? 'not-allowed'
                    : 'pointer';

              // スキルパネル(useCursorTooltip)と同じ形式で、マウスカーソルに追従する位置に
              // 表示する。カーソルがキャンバス中央より右側にあれば左側(align='left')、
              // 左側にあれば右側(align='right')に出し、画面端でのはみ出しを避ける。
              // canvasWrapperRef(useCtrlWheelZoom)はcallback refで.currentを持たないため、
              // DOM走査でキャンバス要素の矩形を取得する。
              const cursorTooltipPos = (
                e: React.MouseEvent,
              ): { x: number; y: number; align: 'left' | 'right' } => {
                const canvasRect = (e.currentTarget as Element)
                  .closest('.talent-tree-panel__canvas-wrapper')
                  ?.getBoundingClientRect();
                const canvasMidX = canvasRect ? canvasRect.left + canvasRect.width / 2 : Infinity;
                const align: 'left' | 'right' = e.clientX > canvasMidX ? 'left' : 'right';
                const x =
                  align === 'left'
                    ? e.clientX - CURSOR_TOOLTIP_GAP
                    : e.clientX + CURSOR_TOOLTIP_GAP;
                return { x, y: e.clientY, align };
              };

              // ホバー中(enter/move共通)のツールチップ表示処理。要素内でカーソルが動くたび
              // onMouseMoveからも呼ぶことで、hover intentの0.5秒タイマーを最新のカーソル位置で
              // リセットする(=カーソルが動き続けている間は表示されず、静止して初めて表示される)。
              // 既に表示中(同一ノード)の場合はopen内部のisSame判定により遅延なく位置が
              // 更新される(openNodeTooltipImmediateと同じuseAnchorTooltip.openを再利用)。
              const hoverNodeTooltip = (e: React.MouseEvent) => {
                if (isPinned) return;
                openNodeTooltip({
                  node,
                  td,
                  name,
                  desc,
                  unlockRequired,
                  ...cursorTooltipPos(e),
                  pinned: false,
                });
              };

              return (
                <g
                  key={`n${node.id}`}
                  className="talent-tree-panel__node"
                  onClick={(e) => {
                    // ロック中(誤操作防止)はクリックでの取得/解除を無効化し、代わりに
                    // シングルクリックでツールチップを固定/解除する。
                    if (!locked) {
                      handleNodeClick(node.id);
                      return;
                    }
                    openNodeTooltipImmediate({
                      node,
                      td,
                      name,
                      desc,
                      unlockRequired,
                      ...cursorTooltipPos(e),
                      pinned: !isPinned || hoveredNodeInfo?.node.id !== node.id,
                    });
                  }}
                  onMouseDown={(e) => {
                    // ドキュメント側の外側クリック検知(FloatingTooltipのonRequestClose)が、
                    // ノード自身のクリック(固定切り替え/別ノードへの固定移動)より先に
                    // ピン留めを解除してしまわないようにする(useCursorTooltipと同じ対策)。
                    e.stopPropagation();
                  }}
                  onMouseEnter={(e) => {
                    // カーソル形状/選択可能ハイライトは実際のホバー位置に即座に追従させる
                    // (ツールチップ表示側の0.5秒hover intentとは独立させる)。
                    setTrueHoveredId(node.id);
                    hoverNodeTooltip(e);
                  }}
                  onMouseMove={hoverNodeTooltip}
                  onMouseLeave={() => {
                    setTrueHoveredId((prev) => (prev === node.id ? null : prev));
                    if (!isPinned) scheduleTooltipClose();
                  }}
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
          clamp
          align={hoveredNodeInfo.align}
          className={`talent-tree-panel__tooltip${isPinned ? ' talent-tree-panel__tooltip--pinned' : ''}`}
          onRequestClose={isPinned ? closeNodeTooltip : undefined}
          onMouseEnter={cancelTooltipClose}
          onMouseLeave={() => {
            if (!isPinned) scheduleTooltipClose();
          }}
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
            <p className="talent-tree-panel__tooltip-desc">
              {renderMarkup(hoveredNodeInfo.desc, linkTextPopup.handlers)}
            </p>
          )}
          {linkTextPopup.popup && (
            <LinkTextPopup
              state={linkTextPopup.popup}
              handlers={linkTextPopup.handlers}
              onMouseEnter={linkTextPopup.cancelClose}
              onMouseLeave={linkTextPopup.scheduleClose}
            />
          )}
        </FloatingTooltip>
      )}

      {/* 型切替確認ダイアログ */}
      {pendingSwitchBdType !== null && (
        <ConfirmDialog
          message={
            <>
              {tUi('buildPlanner.talentTree.confirmTypeChangeMsg')}
              <br />
              {tUi('buildPlanner.talentTree.confirmLockNote')}
            </>
          }
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

      {/* 推奨アビリティ確認ダイアログ */}
      {pendingRecommend && (
        <ConfirmDialog
          message={
            <>
              {tUi('buildPlanner.talentTree.confirmRecommendMsg')}
              <br />
              {tUi('buildPlanner.talentTree.confirmLockNote')}
            </>
          }
          confirmLabel={tUi('buildPlanner.talentTree.confirmRecommendYes')}
          onConfirm={() => {
            doRecommend();
            setPendingRecommend(false);
          }}
          cancelLabel={tUi('buildPlanner.talentTree.confirmRecommendCancel')}
          onCancel={() => setPendingRecommend(false)}
        />
      )}

      {/* リセット確認ダイアログ */}
      {pendingReset && (
        <ConfirmDialog
          message={
            <>
              {tUi('buildPlanner.talentTree.confirmResetMsg')}
              <br />
              {tUi('buildPlanner.talentTree.confirmLockNote')}
            </>
          }
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
