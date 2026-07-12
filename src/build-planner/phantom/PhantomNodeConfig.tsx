import { useTranslation } from 'react-i18next';
import FactorSlot from './FactorSlot';
import type { PhantomFactorSlotValue, TreeStep } from './phantomData';
import { getActivePhantomNodeIds, stData } from './phantomData';
import { getFactorBaseOptions, getFactorEffectDesc, getNodeIcon } from './phantomView';

// ノード設定リスト(ツリーの各ステップに対応する行)。PhantomPanel から分離。
// 行の種類: 固定ノード / 効果選択 / 因子スロット(単独・タイプ選択・経路依存)。

interface PhantomNodeConfigProps {
  treeSteps: TreeStep[];
  /** 選択状態から算出したアクティブノード集合(path-factor の行種別判定に使用)。 */
  activeNodeIds: ReadonlySet<number>;
  selectedNodeId: number | null;
  phantomTemplateId: number;
  phantomNodeSelections: Record<number, number>;
  phantomFactorSlots: Record<number, PhantomFactorSlotValue | null>;
  professionId: number;
  onToggleNode: (nodeId: number) => void;
  onPhantomNodeSelection: (sameGroupId: number, nodeId: number) => void;
  onPhantomFactorSlot: (groupId: number, value: PhantomFactorSlotValue | null) => void;
}

export default function PhantomNodeConfig({
  treeSteps,
  activeNodeIds,
  selectedNodeId,
  phantomTemplateId,
  phantomNodeSelections,
  phantomFactorSlots,
  professionId,
  onToggleNode,
  onPhantomNodeSelection,
  onPhantomFactorSlot,
}: PhantomNodeConfigProps) {
  const { t } = useTranslation();
  const { t: tg } = useTranslation('game-data');

  const unequippedLabel = t('buildPlanner.phantom.factorUnequipped');

  // 因子スロット本体(全factor系行で共通)
  const renderFactorSlot = (groupId: number) => (
    <FactorSlot
      groupId={groupId}
      current={phantomFactorSlots[groupId] ?? null}
      options={getFactorBaseOptions(tg, groupId, professionId)}
      getDesc={(classKey, grade) => getFactorEffectDesc(tg, classKey, grade)}
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
          onClick={() => onToggleNode(groupId)}
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
                onToggleNode(nodeId);
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

  const renderRow = (step: TreeStep, stepIdx: number) => {
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
            onClick={() => onToggleNode(nodeId)}
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
        if (nodeId !== selected) {
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
                    onToggleNode(nodeId);
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

  return (
    <div className="phantom-node-config">{treeSteps.map((step, idx) => renderRow(step, idx))}</div>
  );
}
