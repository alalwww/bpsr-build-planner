import { useMemo, useState } from 'react';
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
import Chevron from '../components/Chevron';
import Stepper from '../components/Stepper';
import ZoomControls from '../components/ZoomControls';
import { useCtrlWheelZoom } from '../components/useCtrlWheelZoom';
import { useDragScroll } from '../components/useDragScroll';
import CustomDropdown, { type DropdownOption } from './CustomDropdown';
import PhantomBondSection from './PhantomBondSection';
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
  // ツリー側のノード選択とノード設定側の該当行は同じ selectedNodeId を共有し、相互に強調表示する。
  const toggleSelectedNode = (nodeId: number) =>
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
  const [descOpen, setDescOpen] = useState(true);
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
          <button
            type="button"
            className={`phantom-enabled-toggle${phantomEnabled ? ' phantom-enabled-toggle--on' : ' phantom-enabled-toggle--off'}`}
            onClick={() => onPhantomEnabledChange(!phantomEnabled)}
            disabled={!phantomEnabled && currentTemplateLocked}
            title={
              !phantomEnabled && currentTemplateLocked
                ? t('buildPlanner.phantom.enabledLockedTitle', {
                    defaultValue: '選択中のツリーが未開放のためONにできません',
                  })
                : phantomEnabled
                  ? t('buildPlanner.phantom.enabledOn')
                  : t('buildPlanner.phantom.enabledOff')
            }
          >
            {phantomEnabled
              ? t('buildPlanner.phantom.enabledOn')
              : t('buildPlanner.phantom.enabledOff')}
          </button>
        </div>
      </div>

      {/* ボディ */}
      {phantomTemplateId == null ? (
        <div className="phantom-empty">{t('buildPlanner.phantom.templateSelectPrompt')}</div>
      ) : (
        <div className="phantom-body">
          {/* 左: ツリー描画 */}
          <div className="phantom-tree-wrapper">
            {/* ズームコントロール（スクロール外に固定） */}
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
            <div className="phantom-tree-area" ref={treeAreaRef}>
              <PhantomTreeSvg
                treeSteps={treeSteps}
                phantomTemplateId={phantomTemplateId}
                visuallyActiveNodeIds={visuallyActiveNodeIds}
                levelUnlockedNodeIds={levelUnlockedNodeIds}
                selectedNodeId={selectedNodeId}
                phantomNodeSelections={phantomNodeSelections}
                phantomFactorSlots={phantomFactorSlots}
                zoom={zoom}
                onToggleNode={toggleSelectedNode}
              />
            </div>
          </div>

          {/* 右: 絆ポイント + ノード効果 + 設定 */}
          <div className="phantom-right">
            {/* 合計絆ポイント（最上部） */}
            <PhantomBondSection
              phantomTemplateId={phantomTemplateId}
              phantomBondPoints={phantomBondPoints}
              onBondPointsChange={onPhantomBondPointsChange}
              phantomLevel={phantomLevel}
            />

            {/* ノード効果（折り畳み可能） */}
            <div className="phantom-desc-area">
              <button
                type="button"
                className="phantom-desc-toggle"
                onClick={() => setDescOpen((v) => !v)}
              >
                <span>{t('buildPlanner.phantom.nodeEffect')}</span>
                <Chevron open={descOpen} />
              </button>
              {descOpen && (
                <div className="phantom-desc-content">
                  <PhantomNodeEffect
                    selectedNodeId={selectedNodeId}
                    phantomFactorSlots={phantomFactorSlots}
                    phantomLevel={phantomLevel}
                    phantomTemplateId={phantomTemplateId}
                  />
                </div>
              )}
            </div>
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
              onToggleNode={toggleSelectedNode}
              onPhantomNodeSelection={onPhantomNodeSelection}
              onPhantomFactorSlot={onPhantomFactorSlot}
            />
          </div>
        </div>
      )}
    </div>
  );
}
