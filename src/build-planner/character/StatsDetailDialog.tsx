import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import DraggableDialog from '../components/DraggableDialog';
import { ELEMENT_IDS, type StatId } from '../types';
import { FIXED_BASE_VALUE } from '../stats/seasonConstants';
import { computeStatsBundle } from '../store/derivedSelectors';
import { useBuildStore } from '../store/useBuildStore';
import { truncate2, truncate2Str as fmtDec2 } from './statFormat';

interface StatsDetailDialogProps {
  onClose: () => void;
}

const ELEMENTS = ['all', ...ELEMENT_IDS] as const;

function fmtPct(v: number) {
  return `${fmtDec2(v)}%`;
}

// 符号付きで小数点第三位を切り捨てて第二位まで表示する（バフ効果の加算/乗算差分用）。
function fmtSigned(v: number): string {
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  const abs = truncate2(Math.abs(v));
  return `${sign}${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// 符号付きの整数として切り捨てて表示する（バフ効果の素の値の括弧書き用）。
function fmtSignedIntTrunc(v: number): string {
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  return `${sign}${Math.floor(Math.abs(v)).toLocaleString()}`;
}

export default function StatsDetailDialog({ onClose }: StatsDetailDialogProps) {
  const { t } = useTranslation();

  const { rawStats, rawStatsBreakdown, stats, derivedStats } = useBuildStore(
    useShallow(computeStatsBundle),
  );
  const cookingBuff = useBuildStore((s) => s.cookingBuff);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    buffEffects: false,
    attack: true,
    survival: true,
    support: false,
    elemAtk: false,
    elemBonus: false,
    elemResist: false,
    misc: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const te = (key: string) => t(`buildPlanner.detailStats.${key}`);
  const elemName = (elem: string, suffix: string) =>
    `${te(`elem.${elem}`)}${te(`elemSuffix.${suffix}`)}`;

  function Section({
    sectionKey,
    rows,
  }: {
    sectionKey: string;
    rows: { label: string; value: string }[];
  }) {
    const isOpen = openSections[sectionKey] ?? false;
    return (
      <div className="stats-detail__section">
        <button
          type="button"
          className="stats-detail__section-header"
          onClick={() => toggleSection(sectionKey)}
        >
          <span className="stats-detail__section-arrow">{isOpen ? '▼' : '▶'}</span>
          {te(`sections.${sectionKey}`)}
        </button>
        {isOpen && (
          <table className="stats-detail__table">
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="stats-detail__row">
                  <td className="stats-detail__label">{row.label}</td>
                  <td className="stats-detail__value">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  // バフ効果: 素の値(BASE_STATS)から加算/乗算/料理バフのいずれかで変化しているステータスのみ抽出。
  const buffRows = (Object.keys(rawStatsBreakdown) as StatId[])
    .filter((statId) => {
      const entry = rawStatsBreakdown[statId];
      return entry.additive !== 0 || entry.multiplier !== 1 || !!entry.cookingBonus;
    })
    .map((statId) => {
      const entry = rawStatsBreakdown[statId];
      const baseSuffix = entry.base !== 0 ? `(${fmtSignedIntTrunc(entry.base)})` : '';
      return {
        statId,
        label: t(`buildPlanner.stats.${statId}`),
        additive: `${fmtSigned(entry.additive)}${baseSuffix}`,
        multiplier: entry.multiplier === 1 ? '' : `${fmtSigned((entry.multiplier - 1) * 100)}%`,
        cookingBuff: entry.cookingBonus ? fmtSigned(entry.cookingBonus) : '',
      };
    });

  const attackRows = [
    { label: te('stat.strength'), value: fmtDec2(rawStats.strength) },
    { label: te('stat.intellect'), value: fmtDec2(rawStats.intellect) },
    { label: te('stat.agility'), value: fmtDec2(rawStats.agility) },
    { label: te('stat.physicalAtk'), value: fmtDec2(stats.atk) },
    { label: te('stat.magicalAtk'), value: fmtDec2(stats.matk) },
    { label: te('stat.refinedPhysAtk'), value: fmtDec2(rawStats.refinePhysAtk) },
    { label: te('stat.refinedMagAtk'), value: fmtDec2(rawStats.refineMagAtk) },
    { label: te('stat.physicalBoost'), value: fmtPct(derivedStats.physicalBoostPercent) },
    { label: te('stat.magicalBoost'), value: fmtPct(derivedStats.magicalBoostPercent) },
    { label: te('stat.atkSpeed'), value: fmtPct(derivedStats.atkSpeedPercent) },
    { label: te('stat.castSpeed'), value: fmtPct(derivedStats.castSpeedPercent) },
    { label: te('stat.critDamage'), value: fmtPct(derivedStats.critDamageBonusPercent) },
    {
      label: te('stat.luckyHitDamage'),
      value: fmtPct(derivedStats.luckyHitDamageMultiplierPercent),
    },
  ];

  const survivalRows = [
    { label: te('stat.endurance'), value: fmtDec2(rawStats.endurance) },
    { label: te('stat.maxHp'), value: fmtDec2(stats.maxHp) },
    { label: te('stat.physicalDef'), value: fmtDec2(stats.physicalDef) },
    { label: te('stat.magicalDef'), value: fmtDec2(stats.magicalDef) },
    { label: te('stat.refinedDef'), value: fmtDec2(rawStats.refineDef) },
    { label: te('stat.physicalReduction'), value: fmtPct(0) },
    { label: te('stat.magicalReduction'), value: fmtPct(0) },
    {
      label: te('stat.resistDamageReduction'),
      value: fmtPct(derivedStats.resistDamageReductionPercent),
    },
  ];

  const supportRows = [
    { label: te('stat.critRecovery'), value: fmtPct(derivedStats.critRecoveryPercent) },
    { label: te('stat.luckyHitBoost'), value: fmtPct(derivedStats.luckyHitBoostPercent) },
    { label: te('stat.mastery'), value: fmtDec2(rawStats.mastery) },
    { label: te('stat.receivedRecovery'), value: fmtDec2(rawStats.receivedRecovery) },
    { label: te('stat.barrierStrength'), value: fmtPct(rawStats.barrierStrength / 100) },
    { label: te('stat.receivedBarrier'), value: fmtPct(0) },
  ];

  const elemAtkRows = ELEMENTS.map((elem) => ({
    label: elemName(elem, 'atk'),
    value: fmtDec2(elem === 'all' ? 0 : 0),
  }));

  // シロップ/脊椎試薬による属性強度は、選択中の属性の対応行にのみ加算する。
  const syrupBonusFor = (elem: string): number =>
    cookingBuff.syrupEnabled && cookingBuff.syrupElement === elem
      ? cookingBuff.syrupElementStrength
      : 0;

  const elemBonusRows: { label: string; value: string }[] = [
    { label: elemName('all', 'str'), value: fmtDec2(rawStats.allAttrStr) },
    { label: elemName('all', 'bonus'), value: fmtPct(0) },
    ...ELEMENTS.slice(1).flatMap((elem) => [
      { label: elemName(elem, 'str'), value: fmtDec2(syrupBonusFor(elem)) },
      { label: elemName(elem, 'bonus'), value: fmtPct(0) },
    ]),
  ];

  const elemResistRows: { label: string; value: string }[] = [
    { label: elemName('all', 'resist'), value: fmtDec2(rawStats.allAttrResist) },
    { label: elemName('all', 'reduction'), value: fmtPct(0) },
    ...ELEMENTS.slice(1).flatMap((elem) => [
      { label: elemName(elem, 'resist'), value: fmtDec2(0) },
      { label: elemName(elem, 'reduction'), value: fmtPct(0) },
    ]),
  ];

  const miscRows = [
    { label: te('stat.maxStamina'), value: fmtDec2(FIXED_BASE_VALUE.maxStamina) },
    { label: te('stat.staminaRegen'), value: fmtDec2(derivedStats.staminaRegenPerSecond) },
  ];

  return (
    <DraggableDialog
      title={te('title')}
      onClose={onClose}
      className="stats-detail"
      overlay={false}
      resizable
      initialPos={{ x: 200, y: 60 }}
      initialSize={{ w: 460, h: 540 }}
    >
      <div className="stats-detail__body">
        <div className="stats-detail__section">
          <button
            type="button"
            className="stats-detail__section-header"
            onClick={() => toggleSection('buffEffects')}
          >
            <span className="stats-detail__section-arrow">
              {openSections.buffEffects ? '▼' : '▶'}
            </span>
            {te('sections.buffEffects')}
          </button>
          {openSections.buffEffects &&
            (buffRows.length > 0 ? (
              <table className="stats-detail__table stats-detail__table--buff">
                <thead>
                  <tr className="stats-detail__row">
                    <th className="stats-detail__label" />
                    <th className="stats-detail__value">{te('buffEffects.additive')}</th>
                    <th className="stats-detail__value">{te('buffEffects.multiplier')}</th>
                    <th className="stats-detail__value">{te('buffEffects.cookingBuff')}</th>
                  </tr>
                </thead>
                <tbody>
                  {buffRows.map((row) => (
                    <tr key={row.statId} className="stats-detail__row">
                      <td className="stats-detail__label">{row.label}</td>
                      <td className="stats-detail__value">{row.additive}</td>
                      <td className="stats-detail__value">{row.multiplier}</td>
                      <td className="stats-detail__value">{row.cookingBuff}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="stats-detail__empty">{te('buffEffects.empty')}</p>
            ))}
        </div>
        <Section sectionKey="attack" rows={attackRows} />
        <Section sectionKey="survival" rows={survivalRows} />
        <Section sectionKey="support" rows={supportRows} />
        <Section sectionKey="elemAtk" rows={elemAtkRows} />
        <Section sectionKey="elemBonus" rows={elemBonusRows} />
        <Section sectionKey="elemResist" rows={elemResistRows} />
        <Section sectionKey="misc" rows={miscRows} />
      </div>
    </DraggableDialog>
  );
}
