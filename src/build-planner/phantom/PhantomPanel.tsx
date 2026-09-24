import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import './phantom.css';
import type { TreeStep } from './phantomData';
import {
  buildTreeSteps,
  getActivePhantomNodeIds,
  getSTAsset,
  getUnlockLevel,
  iconPathToFile,
  isTemplateLocked,
  stData,
} from './phantomData';
import type { ProfessionKey } from '../profession';
import { PROFESSIONS } from '../profession';
import { useBuildStore } from '../store/useBuildStore';
import CollapsibleSection from '../components/CollapsibleSection';
import { useCollapsiblePanel } from '../components/useCollapsiblePanel';
import Stepper from '../components/Stepper';
import ToggleSwitch from '../components/ToggleSwitch';
import ZoomControls from '../components/ZoomControls';
import { useCtrlWheelZoom } from '../components/useCtrlWheelZoom';
import { useDragScroll } from '../components/useDragScroll';
import CustomDropdown, { type DropdownOption } from './CustomDropdown';
import PhantomBondSection from './PhantomBondSection';
import PhantomEffectSummaryDialog from './PhantomEffectSummaryDialog';
import PhantomNodeConfig from './PhantomNodeConfig';
import PhantomNodeEffect from './PhantomNodeEffect';
import PhantomTreeSvg from './PhantomTreeSvg';

// 心相投影パネル。ヘッダー(レベル/テンプレート/有効化)とレイアウト、
// テンプレート選択に応じたツリー構造・アクティブノード集合の算出を担い、
// 各領域の描画は PhantomTreeSvg / PhantomBondSection / PhantomNodeEffect /
// PhantomNodeConfig に委譲する。

const EXCLUDED_TEMPLATES = new Set([20001, 20002, 20003, 20004]);
const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;

interface PhantomPanelProps {
  professionKey: ProfessionKey;
}

export default function PhantomPanel({ professionKey }: PhantomPanelProps) {
  const { t } = useTranslation();
  const { t: tg } = useTranslation('game-data');
  const professionId = PROFESSIONS[professionKey].professionId;
  const {
    phantomEnabled,
    phantomLevel,
    phantomTemplateId,
    phantomBondPoints,
    phantomNodeSelections,
    phantomFactorSlots,
  } = useBuildStore(
    useShallow((s) => ({
      phantomEnabled: s.phantomEnabled,
      phantomLevel: s.phantomLevel,
      phantomTemplateId: s.phantomTemplateId,
      phantomBondPoints: s.phantomBondPoints,
      phantomNodeSelections: s.phantomNodeSelections,
      phantomFactorSlots: s.phantomFactorSlots,
    })),
  );
  // 未開放のツリー選択中はONへの切り替えを禁止する(store側のsetPhantomEnabledガードと対応)。
  const currentTemplateLocked = isTemplateLocked(phantomTemplateId, phantomLevel);
  const onPhantomEnabledChange = useBuildStore((s) => s.setPhantomEnabled);
  const onPhantomLevelChange = useBuildStore((s) => s.setPhantomLevel);
  const onPhantomTemplateIdChange = useBuildStore((s) => s.setPhantomTemplateId);
  const onPhantomBondPointsChange = useBuildStore((s) => s.setPhantomBondPoints);
  const onPhantomNodeSelection = useBuildStore((s) => s.setPhantomNodeSelection);
  const onPhantomFactorSlot = useBuildStore((s) => s.setPhantomFactorSlot);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [effectSummaryOpen, setEffectSummaryOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(true);
  const [rightPaneCollapsed, toggleRightPaneCollapsed, openRightPane] = useCollapsiblePanel(
    'bpsr-phantom-right-collapsed',
  );
  // ツリー側のノード選択とノード設定側の該当行は同じ selectedNodeId を共有し、相互に強調表示する。
  const toggleSelectedNode = (nodeId: number) =>
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
  // 選択操作がツリー/設定リストどちらで行われたかを記録し、選択が変わるたびに
  // 「操作していない側」だけを自動スクロールして選択中の行/ノードを画面内に収める。
  const selectionOriginRef = useRef<'tree' | 'config' | null>(null);
  const onToggleNodeFromTree = (nodeId: number) => {
    selectionOriginRef.current = 'tree';
    toggleSelectedNode(nodeId);
    // 詳細ペインを閉じたままだとノード効果が見えないため、タップに連動して開く
    // (スマホでは折りたたみが既定のため、特に重要)。
    openRightPane();
  };
  const onToggleNodeFromConfig = (nodeId: number) => {
    selectionOriginRef.current = 'config';
    toggleSelectedNode(nodeId);
  };
  // ツリーの背景(ノード以外)をクリックした際、開いている詳細ペインを閉じる
  // (スマホではオーバーレイ表示のため、ツリー側を操作したい時の導線として必要)。
  // ノード自体のクリックはバブリングしてここにも届くため、closestで除外する。
  const onTreeAreaClick = (e: React.MouseEvent) => {
    if (rightPaneCollapsed) return;
    if ((e.target as HTMLElement).closest('.phantom-tree-node')) return;
    toggleRightPaneCollapsed();
  };
  useEffect(() => {
    if (selectedNodeId == null) return;
    const scrollToSelection = () => {
      if (selectionOriginRef.current === 'tree') {
        document
          .querySelector('.phantom-node-config .phantom-config-row--highlight')
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } else if (selectionOriginRef.current === 'config') {
        document
          .querySelector('.phantom-tree-area .phantom-tree-node[data-selected="true"]')
          ?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
      }
    };
    // ツリー側のノードタップで詳細ペイン(phantom-right)を初めて開く場合、
    // .phantom-right の width transition(0.18s、32px→展開幅)が完了する前に
    // scrollIntoView すると、まだ折りたたみ状態の幅(32px、テキストが縦に折り返された
    // 状態)でレイアウト計算されてしまい、選択行が画面外まで飛んでしまうことがあった。
    // transition時間より余裕を持たせて遅延させ、レイアウトが確定してから実行することで
    // この問題を避けつつ、behavior:'smooth' のスクロールアニメーションを維持する。
    const timer = setTimeout(scrollToSelection, 200);
    return () => clearTimeout(timer);
  }, [selectedNodeId]);
  const {
    zoom,
    setZoom,
    ref: treeAreaZoomRef,
  } = useCtrlWheelZoom({ min: ZOOM_MIN, max: ZOOM_MAX, step: ZOOM_STEP });
  // 背景ドラッグでのスクロール。ズームrefと同じ要素(.phantom-tree-area)に付けるため合成する。
  const { ref: treeAreaDragRef } = useDragScroll('.phantom-tree-node');
  const treeAreaRef = (node: HTMLDivElement | null) => {
    treeAreaZoomRef(node);
    treeAreaDragRef(node);
  };

  const sortedTemplates = useMemo(
    () =>
      Object.entries(stData.templates)
        .map(([id, tmpl]) => ({ id: parseInt(id), ...tmpl }))
        .filter((t) => !EXCLUDED_TEMPLATES.has(t.id))
        .sort((a, b) => a.sortId - b.sortId),
    [],
  );

  const templateOptions: DropdownOption[] = useMemo(
    () =>
      sortedTemplates.map((tmpl) => {
        const requiredLevel = getUnlockLevel(tmpl.unlockCondition);
        const locked = requiredLevel > phantomLevel;
        return {
          value: String(tmpl.id),
          label: tg(`seasonTalents.templates.${tmpl.id}`),
          icon: getSTAsset(iconPathToFile(tmpl.icon)),
          ...(locked && {
            sublabel: t('buildPlanner.phantom.templateLockedSuffix', {
              level: requiredLevel,
              defaultValue: `（Lv.${requiredLevel}で開放）`,
            }),
          }),
        };
      }),
    [sortedTemplates, tg, t, phantomLevel],
  );

  const treeSteps = useMemo((): TreeStep[] => {
    if (phantomTemplateId == null) return [];
    const tmpl = stData.templates[String(phantomTemplateId)];
    if (!tmpl) return [];
    return buildTreeSteps(tmpl.rootNodeId, phantomTemplateId);
  }, [phantomTemplateId]);

  const activeNodeIds = useMemo(() => {
    if (phantomTemplateId == null) return new Set<number>();
    const tmpl = stData.templates[String(phantomTemplateId)];
    if (!tmpl) return new Set<number>();
    return getActivePhantomNodeIds(tmpl.rootNodeId, phantomTemplateId, phantomNodeSelections);
  }, [phantomTemplateId, phantomNodeSelections]);

  // path-factor で複数アクティブになる場合、ユーザーが選択していない方を視覚的に非アクティブ扱い
  const visuallyActiveNodeIds = useMemo(() => {
    const result = new Set(activeNodeIds);
    for (const step of treeSteps) {
      if (step.kind !== 'path-factor') continue;
      const activeStepIds = step.nodeIds.filter((id) => activeNodeIds.has(id));
      if (activeStepIds.length <= 1) continue;
      const storedSel = phantomNodeSelections[step.sameGroupId];
      const chosen =
        storedSel !== undefined && activeStepIds.includes(storedSel) ? storedSel : activeStepIds[0];
      for (const id of activeStepIds) {
        if (id !== chosen) result.delete(id);
      }
    }
    return result;
  }, [activeNodeIds, treeSteps, phantomNodeSelections]);

  // ノード個別の開放Lv(潜在Lv)に達しているノードの集合。選択/因子装着自体は制限しないが、
  // 未達のノードは不活性表示にし、効果は反映されない(calculateRawStats.ts側の同判定と対応)。
  // ツリー(テンプレート)自体が未開放の場合はphantomEnabledが自動的にfalseになる(store側)ため、
  // ここではノード個別の開放Lvのみ判定すればよい。
  const levelUnlockedNodeIds = useMemo(() => {
    const result = new Set<number>();
    for (const step of treeSteps) {
      for (const nodeId of step.nodeIds) {
        const node = stData.treeNodes[String(nodeId)];
        if (node && phantomLevel >= getUnlockLevel(node.unlockCondition)) result.add(nodeId);
      }
    }
    return result;
  }, [treeSteps, phantomLevel]);

  return (
    <div className="phantom-panel">
      {/* ヘッダー 2行 */}
      <div className="phantom-header">
        <div className="phantom-header-row">
          <span className="phantom-header-label">{t('buildPlanner.phantom.level')}</span>
          <Stepper
            className="stepper-inline"
            layout="inline"
            value={phantomLevel}
            min={1}
            max={100}
            onChange={onPhantomLevelChange}
          />
        </div>
        <div className="phantom-header-row">
          <span className="phantom-header-label">{t('buildPlanner.phantom.template')}</span>
          <CustomDropdown
            className="phantom-template-dropdown"
            options={templateOptions}
            value={phantomTemplateId != null ? String(phantomTemplateId) : ''}
            placeholder={t('buildPlanner.phantom.templatePlaceholder')}
            onChange={(v) => onPhantomTemplateIdChange(v === '' ? null : parseInt(v))}
          />
          <ToggleSwitch
            checked={phantomEnabled}
            onChange={onPhantomEnabledChange}
            disabled={!phantomEnabled && currentTemplateLocked}
            label={
              phantomEnabled
                ? t('buildPlanner.phantom.enabledOn')
                : t('buildPlanner.phantom.enabledOff')
            }
            title={
              !phantomEnabled && currentTemplateLocked
                ? t('buildPlanner.phantom.enabledLockedTitle', {
                    defaultValue: '選択中のツリーが未開放のためONにできません',
                  })
                : phantomEnabled
                  ? t('buildPlanner.phantom.enabledOn')
                  : t('buildPlanner.phantom.enabledOff')
            }
          />
          {phantomTemplateId != null && (
            <button
              type="button"
              className="phantom-effect-summary-btn"
              onClick={() => setEffectSummaryOpen(true)}
            >
              {t('buildPlanner.phantom.effectSummaryButton')}
            </button>
          )}
        </div>
      </div>

      {/* ボディ */}
      {phantomTemplateId == null ? (
        <div className="phantom-empty">{t('buildPlanner.phantom.templateSelectPrompt')}</div>
      ) : (
        <div
          className="phantom-body"
          style={{ backgroundImage: `url(${getSTAsset('virtual_scene_bg_24.png')})` }}
        >
          {/* 左: ツリー描画 */}
          <div className="phantom-tree-wrapper">
            {/* ヘッダー（スクロール外に固定）: 無効時の注意書き(左詰め) + ズームコントロール */}
            <div className="phantom-tree-header">
              {!phantomEnabled && (
                <span className="phantom-tree-header__notice">
                  {t('buildPlanner.phantom.disabledNotice')}
                </span>
              )}
              <ZoomControls
                zoom={zoom}
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                step={ZOOM_STEP}
                onChange={setZoom}
                resetTitle={t('buildPlanner.phantom.resetTooltip')}
                className="phantom-zoom-controls"
                buttonClassName="phantom-zoom-btn"
                percentClassName="phantom-zoom-pct"
              />
            </div>
            <div className="phantom-tree-area" ref={treeAreaRef} onClick={onTreeAreaClick}>
              <PhantomTreeSvg
                treeSteps={treeSteps}
                phantomTemplateId={phantomTemplateId}
                visuallyActiveNodeIds={visuallyActiveNodeIds}
                levelUnlockedNodeIds={levelUnlockedNodeIds}
                selectedNodeId={selectedNodeId}
                phantomFactorSlots={phantomFactorSlots}
                zoom={zoom}
                onToggleNode={onToggleNodeFromTree}
              />
            </div>
          </div>

          {/* 右: 絆ポイント + ノード効果 + 設定 */}
          <div className={`phantom-right${rightPaneCollapsed ? ' phantom-right--collapsed' : ''}`}>
            <button
              type="button"
              className="phantom-right__collapse-toggle"
              onClick={toggleRightPaneCollapsed}
              title={t(
                rightPaneCollapsed
                  ? 'buildPlanner.phantom.expandPane'
                  : 'buildPlanner.phantom.collapsePane',
              )}
              aria-label={t(
                rightPaneCollapsed
                  ? 'buildPlanner.phantom.expandPane'
                  : 'buildPlanner.phantom.collapsePane',
              )}
            >
              {rightPaneCollapsed ? '‹' : '›'}
            </button>
            {!rightPaneCollapsed && (
              <>
                {/* 絆ポイント・ノード効果は常時表示したい情報のため、下のノード設定側だけを
                    スクロールさせ、ここは固定表示のままにする。 */}
                <div className="phantom-right__fixed">
                  {/* 合計絆ポイント（最上部） */}
                  <PhantomBondSection
                    phantomTemplateId={phantomTemplateId}
                    phantomBondPoints={phantomBondPoints}
                    onBondPointsChange={onPhantomBondPointsChange}
                    phantomLevel={phantomLevel}
                  />

                  {/* ノード効果（折り畳み可能） */}
                  <CollapsibleSection
                    className="phantom-desc-area"
                    toggleClassName="phantom-desc-toggle"
                    open={descOpen}
                    onToggle={() => setDescOpen((v) => !v)}
                    label={t('buildPlanner.phantom.nodeEffect')}
                  >
                    <div className="phantom-desc-content">
                      <PhantomNodeEffect
                        selectedNodeId={selectedNodeId}
                        phantomFactorSlots={phantomFactorSlots}
                        phantomLevel={phantomLevel}
                        phantomTemplateId={phantomTemplateId}
                      />
                    </div>
                  </CollapsibleSection>
                </div>
                <div className="phantom-right__scroll">
                  {/* ノード設定 */}
                  <PhantomNodeConfig
                    treeSteps={treeSteps}
                    activeNodeIds={activeNodeIds}
                    levelUnlockedNodeIds={levelUnlockedNodeIds}
                    selectedNodeId={selectedNodeId}
                    phantomTemplateId={phantomTemplateId}
                    phantomNodeSelections={phantomNodeSelections}
                    phantomFactorSlots={phantomFactorSlots}
                    professionId={professionId}
                    onToggleNode={onToggleNodeFromConfig}
                    onPhantomNodeSelection={onPhantomNodeSelection}
                    onPhantomFactorSlot={onPhantomFactorSlot}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {effectSummaryOpen && phantomTemplateId != null && (
        <PhantomEffectSummaryDialog
          onClose={() => setEffectSummaryOpen(false)}
          phantomEnabled={phantomEnabled}
          phantomTemplateId={phantomTemplateId}
          phantomLevel={phantomLevel}
          phantomBondPoints={phantomBondPoints}
          phantomNodeSelections={phantomNodeSelections}
          phantomFactorSlots={phantomFactorSlots}
          treeSteps={treeSteps}
          activeNodeIds={activeNodeIds}
          levelUnlockedNodeIds={levelUnlockedNodeIds}
          professionId={professionId}
        />
      )}
    </div>
  );
}
