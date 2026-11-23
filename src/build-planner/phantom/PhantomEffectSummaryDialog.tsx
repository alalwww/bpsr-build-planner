import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CollapsibleSection from '../components/CollapsibleSection';
import DraggableDialog from '../components/DraggableDialog';
import LinkTextPopup from '../components/LinkTextPopup';
import { renderMarkup } from '../components/renderMarkup';
import { useLinkTextPopup } from '../components/useLinkTextPopup';
import { truncate2Str as fmtDec2 } from '../character/statFormat';
import { RAW_PERCENT_STAT_IDS } from '../stats/attrMaps';
import { affixEffectText, getActiveAffixEffects } from './phantomAffixData';
import { BASE_STATS } from '../stats/baseStats';
import type { StatId } from '../types';
import type { PhantomFactorSlotValue, TreeStep } from './phantomData';
import { getUnlockLevel, stData } from './phantomData';
import {
  computeFactorNodeRows,
  computeOrdinaryNodeRows,
  computePhantomEffectTotals,
  formatPctDelta,
  type PhantomNodeRow,
} from './phantomEffectSummary';
import {
  factorBaseName,
  formatType1Effect,
  getFactorEffectDesc,
  getNodeEffectDesc,
  getNodeIcon,
} from './phantomView';
import './phantomEffectSummary.css';

// 心相投影ツリーの現在の設定内容(ノード選択+因子装着)を、合計/中級/初級の
// 3分類でまとめて確認するための読み取り専用ダイアログ(S4で絆レベル効果=上級は廃止)。PhantomPanel の「効果一覧」
// ボタンから開く。

interface PhantomEffectSummaryDialogProps {
  onClose: () => void;
  phantomEnabled: boolean;
  phantomTemplateId: number;
  phantomLevel: number;
  phantomNodeSelections: Record<number, number>;
  phantomFactorSlots: Record<number, PhantomFactorSlotValue | null>;
  treeSteps: TreeStep[];
  activeNodeIds: ReadonlySet<number>;
  levelUnlockedNodeIds: ReadonlySet<number>;
  professionId: number;
}

function fmtSigned(v: number): string {
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  return `${sign}${fmtDec2(Math.abs(v))}`;
}

export default function PhantomEffectSummaryDialog({
  onClose,
  phantomEnabled,
  phantomTemplateId,
  phantomLevel,
  phantomNodeSelections,
  phantomFactorSlots,
  treeSteps,
  activeNodeIds,
  levelUnlockedNodeIds,
  professionId,
}: PhantomEffectSummaryDialogProps) {
  const { t } = useTranslation();
  const { t: tg } = useTranslation('game-data');
  const se = (key: string, options: Record<string, unknown> = {}) =>
    t(`buildPlanner.phantom.effectSummary.${key}`, options);
  const linkTextPopup = useLinkTextPopup();

  const [openSections, setOpenSections] = useState({
    total: false,
    intermediate: false,
    ordinary: false,
  });
  const toggle = (key: keyof typeof openSections) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const totals = useMemo(
    () =>
      computePhantomEffectTotals(
        tg,
        phantomTemplateId,
        phantomLevel,
        phantomNodeSelections,
        phantomFactorSlots,
        professionId,
        t('buildPlanner.phantom.affixEffect'),
      ),
    [
      tg,
      t,
      phantomTemplateId,
      phantomLevel,
      phantomNodeSelections,
      phantomFactorSlots,
      professionId,
    ],
  );

  const statRows = [
    ...(Object.keys(BASE_STATS) as StatId[])
      .map((statId) => totals.statDeltas.find((d) => d.statId === statId))
      .filter(
        (d): d is NonNullable<typeof d> => !!d && (d.flat !== 0 || d.pct !== 0 || d.finalPct !== 0),
      )
      .map((d) => ({
        key: d.statId as string,
        label: t(`buildPlanner.stats.${d.statId}`),
        // flatは通常"実数加算"だが、幸運の一撃倍率/バリア強度/被回復力等(RAW_PERCENT_STAT_IDS)は
        // 内部的にflat集計されていても実数値/100=%の規約を持つステータスのため、%表記にする
        // (2026-08-11不具合報告: 幸運の一撃倍率+10%が+1,000.00と表示されていた)。
        flat:
          d.flat !== 0
            ? RAW_PERCENT_STAT_IDS.has(d.statId)
              ? `${fmtSigned(d.flat / 100)}%`
              : fmtSigned(d.flat)
            : '',
        pct: d.pct !== 0 ? `${fmtSigned(formatPctDelta(d.pct))}%` : '',
        finalPct: d.finalPct !== 0 ? `${fmtSigned(formatPctDelta(d.finalPct))}%` : '',
      })),
  ];

  const ordinaryRows = useMemo(
    () =>
      computeOrdinaryNodeRows(
        treeSteps,
        activeNodeIds,
        levelUnlockedNodeIds,
        phantomNodeSelections,
      ),
    [treeSteps, activeNodeIds, levelUnlockedNodeIds, phantomNodeSelections],
  );
  const factorRows = useMemo(
    () =>
      computeFactorNodeRows(treeSteps, activeNodeIds, levelUnlockedNodeIds, phantomNodeSelections),
    [treeSteps, activeNodeIds, levelUnlockedNodeIds, phantomNodeSelections],
  );

  // 初級ノードは選択中/未開放を問わず常に効果説明を表示する(未開放時は
  // phantom-effect-node--locked-*のopacityでグレーアウトさせ、不活性であることを示す)。
  const renderOrdinaryRow = (row: PhantomNodeRow) => {
    const { nodeId, status, stepNum } = row;
    const node = stData.treeNodes[String(nodeId)];
    const name = tg(`seasonTalents.ordinaryEffects.${nodeId}`);
    const icon = getNodeIcon(nodeId, 1);
    const requiredLevel = node ? getUnlockLevel(node.unlockCondition) : 0;
    const oe = stData.ordinaryEffects[String(nodeId)];
    const type1Lines = (oe?.effects ?? []).filter((e) => e[0] === 1);
    const effectDesc = getNodeEffectDesc(tg, nodeId);

    return (
      <div key={nodeId} className={`phantom-effect-node phantom-effect-node--${status}`}>
        <div className="phantom-effect-node__header">
          <span className="phantom-effect-node__num">{stepNum}</span>
          {icon && <img src={icon} className="phantom-effect-node__icon" alt="" />}
          <span className="phantom-effect-node__name">{name}</span>
          {status !== 'active' && (
            <span className="phantom-effect-node__badge">
              {status === 'locked-route'
                ? se('routeLocked')
                : t('buildPlanner.phantom.templateLockedSuffix', { level: requiredLevel })}
            </span>
          )}
        </div>
        {(type1Lines.length > 0 || effectDesc) && (
          <div className="phantom-effect-node__desc">
            {type1Lines.map((e, i) => (
              <div key={i}>{formatType1Effect(tg, e)}</div>
            ))}
            {effectDesc && <div>{renderMarkup(effectDesc, linkTextPopup.handlers)}</div>}
          </div>
        )}
      </div>
    );
  };

  const renderFactorRow = (row: PhantomNodeRow) => {
    const { nodeId, status, stepNum } = row;
    const node = stData.treeNodes[String(nodeId)];
    const slotName = tg(`seasonTalents.intermediateSlots.${nodeId}`);
    const icon = getNodeIcon(nodeId, 2);
    const requiredLevel = node ? getUnlockLevel(node.unlockCondition) : 0;

    if (status === 'active') {
      const current = phantomFactorSlots[nodeId] ?? null;
      const effectDesc = current ? getFactorEffectDesc(tg, current.classKey, current.grade) : '';
      // 因子に埋め込んだ映痕の効果(因子単位の表示。同種は合計、重複不可は因子内の最大値)。
      const affixEffects = getActiveAffixEffects(current);
      return (
        <div key={nodeId} className="phantom-effect-node phantom-effect-node--active">
          <div className="phantom-effect-node__header">
            <span className="phantom-effect-node__num">{stepNum}</span>
            {icon && <img src={icon} className="phantom-effect-node__icon" alt="" />}
            <span className="phantom-effect-node__name">{slotName}</span>
            {current && (
              <span className="phantom-effect-node__factor">
                {factorBaseName(tg, current.classKey)} G{current.grade}
              </span>
            )}
          </div>
          <div className="phantom-effect-node__desc">
            {current ? (
              <>
                {effectDesc && <div>{effectDesc}</div>}
                {affixEffects.map((a) => (
                  <div key={a.group} className="phantom-effect-node__affix">
                    {affixEffectText(tg, a)}
                  </div>
                ))}
              </>
            ) : (
              <div>{t('buildPlanner.phantom.factorUnequipped')}</div>
            )}
          </div>
        </div>
      );
    }
    return (
      <div key={nodeId} className={`phantom-effect-node phantom-effect-node--${status}`}>
        <div className="phantom-effect-node__header">
          <span className="phantom-effect-node__num">{stepNum}</span>
          {icon && <img src={icon} className="phantom-effect-node__icon" alt="" />}
          <span className="phantom-effect-node__name">{slotName}</span>
          <span className="phantom-effect-node__badge">
            {status === 'locked-route'
              ? se('routeLocked')
              : t('buildPlanner.phantom.templateLockedSuffix', { level: requiredLevel })}
          </span>
        </div>
      </div>
    );
  };

  return (
    <DraggableDialog
      title={t('buildPlanner.phantom.effectSummaryTitle')}
      onClose={onClose}
      className="phantom-effect-summary"
      overlay={false}
      resizable
      initialSize={{ w: 480, h: 600 }}
    >
      <div
        className={`phantom-effect-summary__status${phantomEnabled ? ' phantom-effect-summary__status--on' : ''}`}
      >
        <span className="phantom-effect-summary__status-badge">
          {phantomEnabled
            ? t('buildPlanner.phantom.enabledOn')
            : t('buildPlanner.phantom.enabledOff')}
        </span>
        {!phantomEnabled && (
          <span className="phantom-effect-summary__status-notice">
            {t('buildPlanner.phantom.disabledNotice')}
          </span>
        )}
      </div>
      <div className="phantom-effect-summary__body">
        <CollapsibleSection
          open={openSections.total}
          onToggle={() => toggle('total')}
          label={se('sections.total')}
          className="phantom-effect-summary__section"
          toggleClassName="phantom-effect-summary__section-header"
        >
          {statRows.length > 0 ? (
            <table className="phantom-effect-summary__table">
              <thead>
                <tr>
                  <th />
                  <th>{se('flatCol')}</th>
                  <th>{se('pctCol')}</th>
                  <th>{se('finalPctCol')}</th>
                </tr>
              </thead>
              <tbody>
                {statRows.map((row) => (
                  <tr key={row.key}>
                    <td className="phantom-effect-summary__label">{row.label}</td>
                    <td>{row.flat}</td>
                    <td>{row.pct}</td>
                    <td>{row.finalPct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="phantom-effect-summary__empty">{se('statEmpty')}</p>
          )}
          {totals.individualEffects.length > 0 && (
            <div className="phantom-effect-summary__individual">
              <div className="phantom-effect-summary__individual-label">
                {se('individualLabel')}
              </div>
              {totals.individualEffects.map((eff) => (
                <div key={eff.key} className="phantom-effect-summary__individual-item">
                  <div className="phantom-effect-summary__individual-name">
                    {eff.icon && (
                      <img
                        src={eff.icon}
                        className="phantom-effect-summary__individual-icon"
                        alt=""
                      />
                    )}
                    <span>{eff.name}</span>
                  </div>
                  <div className="phantom-effect-summary__individual-desc">
                    {renderMarkup(eff.desc, linkTextPopup.handlers)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          open={openSections.intermediate}
          onToggle={() => toggle('intermediate')}
          label={se('sections.intermediate')}
          className="phantom-effect-summary__section"
          toggleClassName="phantom-effect-summary__section-header"
        >
          <div className="phantom-effect-summary__node-list">{factorRows.map(renderFactorRow)}</div>
        </CollapsibleSection>

        <CollapsibleSection
          open={openSections.ordinary}
          onToggle={() => toggle('ordinary')}
          label={se('sections.ordinary')}
          className="phantom-effect-summary__section"
          toggleClassName="phantom-effect-summary__section-header"
        >
          <div className="phantom-effect-summary__node-list">
            {ordinaryRows.map(renderOrdinaryRow)}
          </div>
        </CollapsibleSection>
      </div>
      {linkTextPopup.popup && (
        <LinkTextPopup
          state={linkTextPopup.popup}
          handlers={linkTextPopup.handlers}
          onMouseEnter={linkTextPopup.cancelClose}
          onMouseLeave={linkTextPopup.scheduleClose}
        />
      )}
    </DraggableDialog>
  );
}
