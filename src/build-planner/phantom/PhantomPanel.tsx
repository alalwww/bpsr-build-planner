import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import './phantom.css';
import type { TreeStep } from './phantomData';
import {
  buildChildrenMap,
  buildTreeSteps,
  getActivePhantomNodeIds,
  pfData,
  stData,
} from './phantomData';
import type { ProfessionKey } from '../profession';
import { PROFESSIONS } from '../profession';
import { useBuildStore } from '../store/useBuildStore';
import Chevron from '../components/Chevron';
import Stepper from '../components/Stepper';
import ZoomControls from '../components/ZoomControls';
import { useCtrlWheelZoom } from '../components/useCtrlWheelZoom';
import CustomDropdown, { type DropdownOption } from './CustomDropdown';
import FactorSlot from './FactorSlot'; // ---- Asset loading ----

// ---- Asset loading ----
const stAssets = import.meta.glob('../../assets/season_talents/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;
const getSTAsset = (name: string): string => stAssets[`../../assets/season_talents/${name}`] ?? '';
const iconPathToFile = (icon: string): string => (icon.split('/').pop() ?? '') + '.png';

// ---- Constants (2× base size at 100% zoom) ----
const EXCLUDED_TEMPLATES = new Set([20001, 20002, 20003, 20004]);
const ROW_H = 140;
const SVG_VW = 480;
const CX = SVG_VW / 2;
const R_ROOT = 44;
const R_NODE = 32;
const R_FACTOR = 32;
const BRANCH_OFFSET = 96;
const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;

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

// 潜在因子 effectType=1 のうち、値が%乗算(単位:1/100=1%)であるAttrId
const PHANTOM_FACTOR_PCT_ATTR_IDS = new Set([11014, 11024, 11034, 11044, 11324, 11354]);

// ---- Effect description substitution ----
function renderEffectDesc(template: string, pars: number[], pAsPercent = false): string {
  return template
    .replace(/\{\*Decision\.unmarknormal\((\d+)\)\*\}/g, (_, n) => {
      const v = pars[parseInt(n) - 1];
      return v != null ? String(v) : '?';
    })
    .replace(/\{\*Decision\.unmarkpercent\((\d+)\)\*\}/g, (_, n) => {
      const v = pars[parseInt(n) - 1];
      return v != null ? (v / 100).toFixed(0) + '%' : '?';
    })
    .replace(/\{\*Decision\.unmarktime\((\d+)\)\*\}/g, (_, n) => {
      const v = pars[parseInt(n) - 1];
      return v != null ? (v / 1000).toFixed(1) + '秒' : '?';
    })
    .replace(/\{p(\d+)\}/g, (_, n) => {
      const v = pars[parseInt(n) - 1];
      if (v == null) return '?';
      if (pAsPercent) {
        const pct = v / 100;
        return `${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(1)}%`;
      }
      return String(v);
    })
    .replace(/<style[^>]*>([^<]*)<\/style>/g, '$1')
    .replace(/<linktext=[^>]*>([^<]*)<\/linktext>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}

// ---- PhantomPanelProps ----
interface PhantomPanelProps {
  professionKey: ProfessionKey;
}

// ---- Main component ----
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
  const [bondEffectsOpen, setBondEffectsOpen] = useState(false);
  const {
    zoom,
    setZoom,
    ref: treeAreaRef,
  } = useCtrlWheelZoom({ min: ZOOM_MIN, max: ZOOM_MAX, step: ZOOM_STEP });

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
      sortedTemplates.map((tmpl) => ({
        value: String(tmpl.id),
        label: tg(`seasonTalents.templates.${tmpl.id}`),
        icon: getSTAsset(iconPathToFile(tmpl.icon)),
      })),
    [sortedTemplates, tg],
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

  const childrenMap = useMemo(() => {
    if (phantomTemplateId == null) return new Map<number, number[]>();
    return buildChildrenMap(phantomTemplateId);
  }, [phantomTemplateId]);

  // Bond level effects for current template
  const bondLevelEffects = useMemo(() => {
    if (phantomTemplateId == null) return [];
    const tmpl = stData.templates[String(phantomTemplateId)];
    if (!tmpl) return [];
    const effectId = tmpl.advancedEffectId;
    return Object.values(stData.advancedEffects)
      .filter((ae) => ae.effectId === effectId)
      .sort((a, b) => a.level - b.level);
  }, [phantomTemplateId]);

  const svgHeight = treeSteps.length * ROW_H;

  // ---- Helpers ----
  const factorBaseName = (classKey: string): string => {
    const g1Id = pfData.byClass[classKey]?.grades[0]?.id;
    if (!g1Id) return classKey;
    return tg(`items.${g1Id}.name`).replace(/・G\d+$/, '');
  };

  const getFactorsForSlot = (groupId: number) => {
    const slot = stData.intermediateSlots[String(groupId)];
    if (!slot) return [];
    const validTypes = slot.factorTypes.length > 0 ? slot.factorTypes : [1];
    const result: Array<{ classKey: string; typeId: number; profId: number }> = [];
    for (const [classKey, fc] of Object.entries(pfData.byClass)) {
      if (!validTypes.includes(fc.typeId)) continue;
      result.push({ classKey, typeId: fc.typeId, profId: fc.professionIds[0] ?? 0 });
    }
    result.sort((a, b) => {
      const aM = a.profId === professionId ? 0 : a.profId === 0 ? 1 : 2;
      const bM = b.profId === professionId ? 0 : b.profId === 0 ? 1 : 2;
      if (aM !== bM) return aM - bM;
      if (a.typeId !== b.typeId) return a.typeId - b.typeId;
      if (a.profId !== b.profId) return a.profId - b.profId;
      return a.classKey.localeCompare(b.classKey);
    });
    return result;
  };

  const getFactorBaseOptions = (groupId: number): DropdownOption[] =>
    getFactorsForSlot(groupId).map((f) => {
      const g1Id = pfData.byClass[f.classKey]?.grades[0]?.id;
      const name = g1Id ? tg(`items.${g1Id}.name`).replace(/・G\d+$/, '') : f.classKey;
      const iconName = pfData.byClass[f.classKey]?.icon;
      const icon = iconName ? getSTAsset(iconName + '.png') : '';
      return { value: f.classKey, label: name, icon };
    });

  // ---- Effect description helpers ----
  const getNodeEffectDesc = (nodeId: number): string => {
    const oe = stData.ordinaryEffects[String(nodeId)];
    if (!oe) return '';
    const idx = oe.effects.findIndex((e) => e[0] === 3);
    if (idx < 0) return '';
    const buffId = oe.effects[idx][1];
    const pars = oe.buffPars[idx] ?? [];
    const tmpl = tg(`attrDescs.${buffId}`, { defaultValue: '' });
    if (!tmpl) return '';
    return renderEffectDesc(tmpl, pars);
  };

  const getFactorEffectDesc = (classKey: string, grade: number): string => {
    const fc = pfData.byClass[classKey];
    if (!fc) return '';
    const gradeData = fc.grades[grade - 1];
    if (!gradeData) return '';
    // type 3: buff description
    const idx3 = gradeData.effects.findIndex((e) => e[0] === 3);
    if (idx3 >= 0) {
      const buffId = gradeData.effects[idx3][1];
      const pars = gradeData.buffPars?.[idx3] ?? [];
      const tmpl = tg(`attrDescs.${buffId}`, { defaultValue: '' });
      if (tmpl) return renderEffectDesc(tmpl, pars, true);
    }
    // type 1: stat boost（極性・恒常性など）
    const type1 = gradeData.effects.filter((e) => e[0] === 1);
    if (type1.length > 0) {
      return type1
        .map((e) => {
          const label = tg(`attributes.${e[1]}`, { defaultValue: String(e[1]) });
          if (PHANTOM_FACTOR_PCT_ATTR_IDS.has(e[1])) {
            const pct = e[2] / 100;
            return `${label} +${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(2)}%`;
          }
          return `${label} +${e[2]}`;
        })
        .join(', ');
    }
    return '';
  };

  // ---- SVG rendering ----
  const renderSVGLines = () =>
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
          const isActivePath =
            visuallyActiveNodeIds.has(nodeId) && visuallyActiveNodeIds.has(nextId);
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

  const renderSVGNode = (nodeId: number, _step: TreeStep, si: number) => {
    const node = stData.treeNodes[String(nodeId)];
    if (!node) return null;
    const [nx, ny] = nodePositions.get(nodeId) ?? [CX, 0];
    const isActive = visuallyActiveNodeIds.has(nodeId);
    const isSelected = selectedNodeId === nodeId;
    const isRoot = si === 0;
    const isChosenChoice =
      node.sameGroupId !== 0 && phantomNodeSelections[node.sameGroupId] === nodeId;
    const handleClick = () => toggleSelectedNode(nodeId);

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

  // ---- Config row render ----
  const getNodeIcon = (nodeId: number, nodeType: 1 | 2): string => {
    if (nodeType === 1) {
      const oe = stData.ordinaryEffects[String(nodeId)];
      return oe ? getSTAsset(iconPathToFile(oe.icon)) : '';
    } else {
      const slot = stData.intermediateSlots[String(nodeId)];
      return slot ? getSTAsset(iconPathToFile(slot.icon)) : '';
    }
  };

  const unequippedLabel = t('buildPlanner.phantom.factorUnequipped');

  // 因子スロット本体(全factor系行で共通)
  const renderFactorSlot = (groupId: number) => (
    <FactorSlot
      groupId={groupId}
      current={phantomFactorSlots[groupId] ?? null}
      options={getFactorBaseOptions(groupId)}
      getDesc={getFactorEffectDesc}
      unequippedLabel={unequippedLabel}
      onSet={onPhantomFactorSlot}
    />
  );

  // スロット名ヘッダー付きの因子スロット(solo-factor / path-factor 単一アクティブ)
  const renderFactorSlotWithHeader = (groupId: number) => {
    const iconSrc = getNodeIcon(groupId, 2);
    const slotName = tg(`seasonTalents.intermediateSlots.${groupId}`);
    return (
      <div className="phantom-factor-with-label">
        <div
          className={`phantom-factor-slot-header phantom-config-node-clickable${selectedNodeId === groupId ? ' phantom-config-node-clickable--highlight' : ''}`}
          onClick={() => toggleSelectedNode(groupId)}
        >
          {iconSrc && <img src={iconSrc} className="phantom-config-node-icon" alt="" />}
          <span className="phantom-factor-label">{slotName}</span>
        </div>
        {renderFactorSlot(groupId)}
      </div>
    );
  };

  // 因子タイプ選択ボタン群 + 選択中タイプの因子スロット
  // (choice-factor-type / path-factor 複数アクティブ)。選択変更時は旧スロットの因子をクリアする。
  const renderFactorTypeChoice = (nodeIds: number[], selected: number, sameGroupId: number) => (
    <div className="phantom-factor-with-label">
      <div className="phantom-factor-type-btns">
        {nodeIds.map((nodeId) => {
          const slotName = tg(`seasonTalents.intermediateSlots.${nodeId}`);
          const iconSrc = getNodeIcon(nodeId, 2);
          return (
            <button
              key={nodeId}
              type="button"
              className={`phantom-choice-btn${selected === nodeId ? ' phantom-choice-btn--active' : ''}${selectedNodeId === nodeId ? ' phantom-choice-btn--highlight' : ''}`}
              onClick={() => {
                if (nodeId !== selected && phantomFactorSlots[selected]) {
                  onPhantomFactorSlot(selected, null);
                }
                onPhantomNodeSelection(sameGroupId, nodeId);
                toggleSelectedNode(nodeId);
              }}
            >
              {iconSrc && <img src={iconSrc} className="phantom-choice-btn-icon" alt="" />}
              {slotName}
            </button>
          );
        })}
      </div>
      {renderFactorSlot(selected)}
    </div>
  );

  const renderNodeConfigRow = (step: TreeStep, stepIdx: number) => {
    const rowKey = `step-${stepIdx}`;
    const num = <span className="phantom-step-num">{stepIdx + 1}</span>;

    if (step.kind === 'fixed-ordinary') {
      const nodeId = step.nodeIds[0];
      const node = stData.treeNodes[String(nodeId)];
      const iconSrc = node ? getNodeIcon(nodeId, node.nodeType as 1 | 2) : '';
      return (
        <div key={rowKey} className="phantom-config-row phantom-config-row--fixed">
          {num}
          <div
            className={`phantom-config-node-clickable${selectedNodeId === nodeId ? ' phantom-config-node-clickable--highlight' : ''}`}
            onClick={() => toggleSelectedNode(nodeId)}
          >
            {iconSrc && <img src={iconSrc} className="phantom-config-node-icon" alt="" />}
            <span className="phantom-node-name">
              {tg(`seasonTalents.ordinaryEffects.${nodeId}`)}
            </span>
          </div>
        </div>
      );
    }

    if (step.kind === 'choice-ordinary') {
      const selected = phantomNodeSelections[step.sameGroupId];
      const handleChoiceOrdinary = (nodeId: number) => {
        // 選択変更により非アクティブになるノードの因子をクリア
        if (phantomTemplateId != null && nodeId !== selected) {
          const tmpl = stData.templates[String(phantomTemplateId)];
          if (tmpl) {
            const newSels = { ...phantomNodeSelections, [step.sameGroupId]: nodeId };
            const newActive = getActivePhantomNodeIds(tmpl.rootNodeId, phantomTemplateId, newSels);
            for (const s of treeSteps) {
              for (const sid of s.nodeIds) {
                if (activeNodeIds.has(sid) && !newActive.has(sid) && phantomFactorSlots[sid]) {
                  onPhantomFactorSlot(sid, null);
                }
              }
            }
          }
        }
        onPhantomNodeSelection(step.sameGroupId, nodeId);
      };
      return (
        <div key={rowKey} className="phantom-config-row">
          {num}
          <div className="phantom-choice-btns">
            {step.nodeIds.map((nodeId) => {
              const iconSrc = getNodeIcon(nodeId, 1);
              return (
                <button
                  key={nodeId}
                  type="button"
                  className={`phantom-choice-btn${selected === nodeId ? ' phantom-choice-btn--active' : ''}${selectedNodeId === nodeId ? ' phantom-choice-btn--highlight' : ''}`}
                  onClick={() => {
                    handleChoiceOrdinary(nodeId);
                    toggleSelectedNode(nodeId);
                  }}
                >
                  {iconSrc && <img src={iconSrc} className="phantom-choice-btn-icon" alt="" />}
                  {tg(`seasonTalents.ordinaryEffects.${nodeId}`)}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (step.kind === 'solo-factor') {
      return (
        <div key={rowKey} className="phantom-config-row phantom-config-row--factor">
          {num}
          {renderFactorSlotWithHeader(step.nodeIds[0])}
        </div>
      );
    }

    if (step.kind === 'choice-factor-type') {
      const selected = phantomNodeSelections[step.sameGroupId] ?? step.nodeIds[0];
      return (
        <div key={rowKey} className="phantom-config-row phantom-config-row--factor">
          {num}
          {renderFactorTypeChoice(step.nodeIds, selected, step.sameGroupId)}
        </div>
      );
    }

    if (step.kind === 'path-factor') {
      const activeIds = step.nodeIds.filter((id) => activeNodeIds.has(id));
      if (activeIds.length === 0) {
        return (
          <div key={rowKey} className="phantom-config-row phantom-config-row--inactive">
            {num}
            <span className="phantom-inactive-label">
              {t('buildPlanner.phantom.pathUndecided')}
            </span>
          </div>
        );
      }
      if (activeIds.length === 1) {
        return (
          <div key={rowKey} className="phantom-config-row phantom-config-row--factor">
            {num}
            {renderFactorSlotWithHeader(activeIds[0])}
          </div>
        );
      }
      // 複数アクティブ（例: 虚妄断罪で「断罪・癒」を選択）: choice-factor-type と同じ選択ボタン UI
      const storedSel = phantomNodeSelections[step.sameGroupId];
      const selected =
        storedSel !== undefined && activeIds.includes(storedSel) ? storedSel : activeIds[0];
      return (
        <div key={rowKey} className="phantom-config-row phantom-config-row--factor">
          {num}
          {renderFactorTypeChoice(activeIds, selected, step.sameGroupId)}
        </div>
      );
    }

    return null;
  };

  // ---- Node effect area ----
  const renderNodeEffect = () => {
    if (selectedNodeId == null) {
      return (
        <span className="phantom-desc-placeholder">
          {t('buildPlanner.phantom.nodeEffectPlaceholder')}
        </span>
      );
    }
    const node = stData.treeNodes[String(selectedNodeId)];
    if (!node) return null;

    if (node.nodeType === 1) {
      const name = tg(`seasonTalents.ordinaryEffects.${selectedNodeId}`);
      const oe = stData.ordinaryEffects[String(selectedNodeId)];
      const iconSrc = oe ? getSTAsset(iconPathToFile(oe.icon)) : '';
      const effects = oe?.effects ?? [];
      const effectDesc = getNodeEffectDesc(selectedNodeId);
      return (
        <>
          <div className="phantom-desc-header">
            {iconSrc && <img src={iconSrc} className="phantom-desc-icon" alt="" />}
            <span className="phantom-desc-name">{name}</span>
          </div>
          <div className="phantom-desc-effects">
            {effects
              .filter((e) => e[0] === 1)
              .map((e, i) => {
                const attrName = tg(`attributes.${e[1]}`);
                return (
                  <div key={i} className="phantom-desc-effect">
                    {attrName} +{e[2]}
                  </div>
                );
              })}
            {effectDesc && (
              <div className="phantom-desc-effect phantom-desc-effect--buff">{effectDesc}</div>
            )}
          </div>
        </>
      );
    } else {
      const groupId = node.groupId;
      const slotName = tg(`seasonTalents.intermediateSlots.${groupId}`);
      const slot = stData.intermediateSlots[String(groupId)];
      const iconSrc = slot ? getSTAsset(iconPathToFile(slot.icon)) : '';
      const current = phantomFactorSlots[groupId] ?? null;
      const factorEffectDesc = current ? getFactorEffectDesc(current.classKey, current.grade) : '';
      return (
        <>
          <div className="phantom-desc-header">
            {iconSrc && <img src={iconSrc} className="phantom-desc-icon" alt="" />}
            <span className="phantom-desc-name">
              {t('buildPlanner.phantom.factorSlot')}: {slotName}
            </span>
          </div>
          {current && (
            <div className="phantom-desc-factor">
              {factorBaseName(current.classKey)} G{current.grade}
            </div>
          )}
          {factorEffectDesc && <div className="phantom-desc-text">{factorEffectDesc}</div>}
        </>
      );
    }
  };

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
            title={
              phantomEnabled
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
              <svg
                viewBox={`0 0 ${SVG_VW} ${svgHeight}`}
                width={SVG_VW * zoom}
                height={svgHeight * zoom}
                className="phantom-tree-svg"
              >
                {renderSVGLines()}
                {treeSteps.flatMap((_step, si) =>
                  _step.nodeIds.map((nodeId) => renderSVGNode(nodeId, _step, si)),
                )}
              </svg>
            </div>
          </div>

          {/* 右: 絆ポイント + ノード効果 + 設定 */}
          <div className="phantom-right">
            {/* 合計絆ポイント（最上部） */}
            <div className="phantom-bond-section">
              <div className="phantom-bond-row">
                <span className="phantom-bond-label">{t('buildPlanner.phantom.bondPoints')}</span>
                <Stepper
                  className="stepper-inline"
                  layout="inline"
                  value={phantomBondPoints}
                  min={0}
                  max={60}
                  onChange={onPhantomBondPointsChange}
                />
              </div>
              {/* 絆レベル効果（折り畳み可能） */}
              {bondLevelEffects.length > 0 && (
                <div className="phantom-bond-effects">
                  <button
                    type="button"
                    className="phantom-bond-effects-toggle"
                    onClick={() => setBondEffectsOpen((v) => !v)}
                  >
                    <span>{t('buildPlanner.phantom.bondEffects')}</span>
                    <Chevron open={bondEffectsOpen} />
                  </button>
                  {bondEffectsOpen && (
                    <div className="phantom-bond-effects-list">
                      {bondLevelEffects.map((ae) => {
                        const isActive = phantomBondPoints >= ae.unlockFraction;
                        const idx = ae.effects.findIndex((e) => e[0] === 3);
                        const buffId = idx >= 0 ? ae.effects[idx][1] : null;
                        const pars = idx >= 0 ? (ae.buffPars[idx] ?? []) : [];
                        const tmplStr = buffId
                          ? tg(`attrDescs.${buffId}`, { defaultValue: '' })
                          : '';
                        const desc = tmplStr ? renderEffectDesc(tmplStr, pars) : '';
                        return (
                          <div
                            key={ae.level}
                            className={`phantom-bond-effect${isActive ? ' phantom-bond-effect--active' : ''}`}
                          >
                            <span className="phantom-bond-effect-threshold">
                              {ae.unlockFraction}pt
                            </span>
                            <span className="phantom-bond-effect-desc">
                              {desc || `Lv.${ae.level}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

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
              {descOpen && <div className="phantom-desc-content">{renderNodeEffect()}</div>}
            </div>
            {/* ノード設定 */}
            <div className="phantom-node-config">
              {treeSteps.map((step, idx) => renderNodeConfigRow(step, idx))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
