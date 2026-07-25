import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../components/ConfirmDialog';
import FactorSlot from './FactorSlot';
import type { PhantomFactorSlotValue, TreeStep } from './phantomData';
import { getActivePhantomNodeIds, stData } from './phantomData';
import {
  factorBaseName,
  getFactorBaseOptions,
  getFactorEffectDesc,
  getNodeIcon,
} from './phantomView';

// ノード設定リスト(ツリーの各ステップに対応する行)。PhantomPanel から分離。
// 行の種類: 固定ノード / 効果選択 / 因子スロット(単独・タイプ選択・経路依存)。

interface PhantomNodeConfigProps {
  treeSteps: TreeStep[];
  /** 選択状態から算出したアクティブノード集合(path-factor の行種別判定に使用)。 */
  activeNodeIds: ReadonlySet<number>;
  /** 潜在Lvがノード個別の開放Lvに達しているノードの集合。未達なら不活性表示にする。 */
  levelUnlockedNodeIds: ReadonlySet<number>;
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
  levelUnlockedNodeIds,
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
  // 選択/因子装着自体は妨げないため、クリックハンドラは変更せずスタイルのみ不活性化する。
  const isLocked = (nodeId: number) => !levelUnlockedNodeIds.has(nodeId);

  // onToggleNode はツリー側と共有しており、同じノードを渡すと選択解除(トグルOFF)される。
  // 行全体がクリック領域になったことで、ドロップダウンやStepperの操作のたびに
  // 選択/解除が交互に切り替わってしまうため、設定側では「選択追従」のみ行い
  // 解除はしない(すでに選択中のノードへの操作は無視する)。ツリー側の選択解除機能は
  // そのまま残す。
  const selectNode = (nodeId: number) => {
    if (selectedNodeId !== nodeId) onToggleNode(nodeId);
  };

  // スロット名(intermediateSlots由来)はタイプが同じスロット同士で重複する(例: 「極性」が
  // 複数箇所に出る)ため、確認ダイアログではノード番号(行番号)を前置して一意に区別する。
  const nodeStepNum = new Map<number, number>();
  treeSteps.forEach((step, idx) => {
    for (const nodeId of step.nodeIds) nodeStepNum.set(nodeId, idx + 1);
  });
  const numberedSlotName = (groupId: number) =>
    `${nodeStepNum.get(groupId) ?? '?'}:${tg(`seasonTalents.intermediateSlots.${groupId}`)}`;

  // 同一ツリー内では同じ因子(classKey)を複数スロットに装着できない。既に他スロットで
  // 使用中の因子を選択した場合は即座に上書きせず、どちらを残すか確認ダイアログで決めさせる
  // (候補リストからの単純なフィルター除外だと、入れ替えたいだけの場合に不便なため)。
  const [pendingFactorSwap, setPendingFactorSwap] = useState<{
    groupId: number;
    value: PhantomFactorSlotValue;
    conflictGroupId: number;
    /** 操作中スロット(groupId)の変更前の値。入れ替え確定時にconflictGroupId側へ移す。 */
    previousValue: PhantomFactorSlotValue | null;
  } | null>(null);

  const handleSetFactor = (groupId: number, value: PhantomFactorSlotValue | null) => {
    if (value) {
      const conflict = Object.entries(phantomFactorSlots).find(
        ([gid, v]) => Number(gid) !== groupId && v?.classKey === value.classKey,
      );
      if (conflict) {
        setPendingFactorSwap({
          groupId,
          value,
          conflictGroupId: Number(conflict[0]),
          previousValue: phantomFactorSlots[groupId] ?? null,
        });
        return;
      }
    }
    onPhantomFactorSlot(groupId, value);
  };

  // 因子スロット本体(全factor系行で共通)
  const renderFactorSlot = (groupId: number) => (
    <FactorSlot
      groupId={groupId}
      current={phantomFactorSlots[groupId] ?? null}
      options={getFactorBaseOptions(tg, groupId, professionId)}
      getDesc={(classKey, grade) => getFactorEffectDesc(tg, classKey, grade)}
      unequippedLabel={unequippedLabel}
      onSet={handleSetFactor}
    />
  );

  // スロット名ヘッダー付きの因子スロット(solo-factor / path-factor 単一アクティブ)。
  // クリック選択は行全体(phantom-config-row)側が担うため、ここでは表示のみ行う。
  const renderFactorSlotWithHeader = (groupId: number) => {
    const iconSrc = getNodeIcon(groupId, 2);
    const slotName = tg(`seasonTalents.intermediateSlots.${groupId}`);
    return (
      <div
        className={`phantom-factor-with-label${isLocked(groupId) ? ' phantom-config-locked' : ''}`}
      >
        <div className="phantom-factor-slot-header">
          {iconSrc && <img src={iconSrc} className="phantom-config-node-icon" alt="" />}
          <span className="phantom-factor-label">{slotName}</span>
        </div>
        {renderFactorSlot(groupId)}
      </div>
    );
  };

  // 因子タイプ選択ボタン群 + 選択中タイプの因子スロット
  // (choice-factor-type / path-factor 複数アクティブ)。選択変更時は旧スロットの因子をクリアする。
  // ボタン自体は行全体のクリック(選択中タイプのノードを選択)とは別に、クリックしたタイプへの
  // 切り替えを担うため stopPropagation で行のクリックハンドラへのバブルを止める。
  const renderFactorTypeChoice = (nodeIds: number[], selected: number, sameGroupId: number) => (
    <div
      className={`phantom-factor-with-label${isLocked(selected) ? ' phantom-config-locked' : ''}`}
    >
      <div className="phantom-factor-type-btns">
        {nodeIds.map((nodeId) => {
          const slotName = tg(`seasonTalents.intermediateSlots.${nodeId}`);
          const iconSrc = getNodeIcon(nodeId, 2);
          return (
            <button
              key={nodeId}
              type="button"
              className={`phantom-choice-btn${selected === nodeId ? ' phantom-choice-btn--active' : ''}${selectedNodeId === nodeId ? ' phantom-choice-btn--highlight' : ''}${isLocked(nodeId) ? ' phantom-config-locked' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (nodeId !== selected && phantomFactorSlots[selected]) {
                  onPhantomFactorSlot(selected, null);
                }
                onPhantomNodeSelection(sameGroupId, nodeId);
                selectNode(nodeId);
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

  // 行1つ分の描画に必要な情報。行番号を含む行全体をクリック領域・強調表示の対象とするため、
  // 各行種別(kind)は「クリックで選択するノード(clickNodeId)」と「ツリー側選択との一致判定に
  // 使うノード集合(highlightIds)」を用意し、実際の枠・クリックハンドラは renderRow 側で共通化する。
  // choice系(2択/因子タイプ選択)は、選択中の項目(chosen)を切り替えるボタン操作と、行の
  // 「どのノードを見ているか」の選択状態を別々に持つため、clickNodeId には常に現在の
  // chosen ノードを充てる(行内の余白等をクリックした場合はchosenノードを選択したとみなす)。
  const renderRow = (step: TreeStep, stepIdx: number) => {
    const rowKey = `step-${stepIdx}`;
    const num = <span className="phantom-step-num">{stepIdx + 1}</span>;

    let rowKindClassName = '';
    let clickNodeId: number | null = null;
    let highlightIds: number[] = [];
    let content: ReactNode;

    if (step.kind === 'fixed-ordinary') {
      const nodeId = step.nodeIds[0];
      const node = stData.treeNodes[String(nodeId)];
      const iconSrc = node ? getNodeIcon(nodeId, node.nodeType as 1 | 2) : '';
      rowKindClassName = ' phantom-config-row--fixed';
      clickNodeId = nodeId;
      highlightIds = [nodeId];
      content = (
        <div
          className={`phantom-config-node-content${isLocked(nodeId) ? ' phantom-config-locked' : ''}`}
        >
          {iconSrc && <img src={iconSrc} className="phantom-config-node-icon" alt="" />}
          <span className="phantom-node-name">{tg(`seasonTalents.ordinaryEffects.${nodeId}`)}</span>
        </div>
      );
    } else if (step.kind === 'choice-ordinary') {
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
      clickNodeId = selected;
      highlightIds = step.nodeIds;
      content = (
        <div className="phantom-choice-btns">
          {step.nodeIds.map((nodeId) => {
            const iconSrc = getNodeIcon(nodeId, 1);
            return (
              <button
                key={nodeId}
                type="button"
                className={`phantom-choice-btn${selected === nodeId ? ' phantom-choice-btn--active' : ''}${selectedNodeId === nodeId ? ' phantom-choice-btn--highlight' : ''}${isLocked(nodeId) ? ' phantom-config-locked' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleChoiceOrdinary(nodeId);
                  selectNode(nodeId);
                }}
              >
                {iconSrc && <img src={iconSrc} className="phantom-choice-btn-icon" alt="" />}
                {tg(`seasonTalents.ordinaryEffects.${nodeId}`)}
              </button>
            );
          })}
        </div>
      );
    } else if (step.kind === 'solo-factor') {
      const nodeId = step.nodeIds[0];
      rowKindClassName = ' phantom-config-row--factor';
      clickNodeId = nodeId;
      highlightIds = [nodeId];
      content = renderFactorSlotWithHeader(nodeId);
    } else if (step.kind === 'choice-factor-type') {
      const selected = phantomNodeSelections[step.sameGroupId] ?? step.nodeIds[0];
      rowKindClassName = ' phantom-config-row--factor';
      clickNodeId = selected;
      highlightIds = step.nodeIds;
      content = renderFactorTypeChoice(step.nodeIds, selected, step.sameGroupId);
    } else if (step.kind === 'path-factor') {
      const activeIds = step.nodeIds.filter((id) => activeNodeIds.has(id));
      if (activeIds.length === 0) {
        rowKindClassName = ' phantom-config-row--inactive';
        content = (
          <span className="phantom-inactive-label">{t('buildPlanner.phantom.pathUndecided')}</span>
        );
      } else if (activeIds.length === 1) {
        rowKindClassName = ' phantom-config-row--factor';
        clickNodeId = activeIds[0];
        highlightIds = activeIds;
        content = renderFactorSlotWithHeader(activeIds[0]);
      } else {
        // 複数アクティブ（例: 虚妄断罪で「断罪・癒」を選択）: choice-factor-type と同じ選択ボタン UI
        const storedSel = phantomNodeSelections[step.sameGroupId];
        const selected =
          storedSel !== undefined && activeIds.includes(storedSel) ? storedSel : activeIds[0];
        rowKindClassName = ' phantom-config-row--factor';
        clickNodeId = selected;
        highlightIds = activeIds;
        content = renderFactorTypeChoice(activeIds, selected, step.sameGroupId);
      }
    } else {
      return null;
    }

    const isRowSelected = selectedNodeId != null && highlightIds.includes(selectedNodeId);
    const rowClassName =
      `phantom-config-row${rowKindClassName}` +
      (clickNodeId != null ? ' phantom-config-row--clickable' : '') +
      (isRowSelected ? ' phantom-config-row--highlight' : '');

    return (
      <div
        key={rowKey}
        className={rowClassName}
        onClick={clickNodeId != null ? () => selectNode(clickNodeId!) : undefined}
      >
        {num}
        {content}
      </div>
    );
  };

  return (
    <div className="phantom-node-config">
      {treeSteps.map((step, idx) => renderRow(step, idx))}
      {pendingFactorSwap && (
        <ConfirmDialog
          message={t('buildPlanner.phantom.factorDuplicateMsg', {
            factor: factorBaseName(tg, pendingFactorSwap.value.classKey),
            slot: numberedSlotName(pendingFactorSwap.conflictGroupId),
          })}
          confirmLabel={t('buildPlanner.phantom.factorDuplicateConfirm')}
          onConfirm={() => {
            const { groupId, value, conflictGroupId, previousValue } = pendingFactorSwap;
            // 真の入れ替え: 操作中スロットには選んだ因子を、重複先には操作中スロットの
            // 変更前の因子(未装着なら未装着)をそのまま移す。
            onPhantomFactorSlot(groupId, value);
            onPhantomFactorSlot(conflictGroupId, previousValue);
            setPendingFactorSwap(null);
          }}
          cancelLabel={t('buildPlanner.confirmCancel', { defaultValue: 'キャンセル' })}
          onCancel={() => setPendingFactorSwap(null)}
        />
      )}
    </div>
  );
}
