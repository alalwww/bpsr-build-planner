import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import DraggableDialog from '../components/DraggableDialog';
import { ELEMENT_IDS, type ElementId, type StatId } from '../types';
import { ELEMENT_ATK_STAT, ELEMENT_ATTR_STR_STAT } from '../stats/attrMaps';
import { diminishingPercent } from '../stats/formulas';
import { FIXED_BASE_VALUE, SEASON_CONSTANTS } from '../stats/seasonConstants';
import { computeStatsBundle } from '../store/derivedSelectors';
import { useBuildStore } from '../store/useBuildStore';
import { truncate2, truncate2Str as fmtDec2 } from './statFormat';

interface StatsDetailDialogProps {
  onClose: () => void;
}

const ELEMENTS = ['all', ...ELEMENT_IDS] as const;

// 会心/ファスト/幸運/器用さ/万能: cookingBonusが最終%表示値への直接加算(単位: %そのまま)のため、
// 追加バフ列では他ステータス(実数加算)と異なり%表記で表示する。
const FINAL_PCT_ADDEND_STAT_IDS = new Set<StatId>(['crit', 'haste', 'luck', 'mastery', 'versatility']);

function fmtPct(v: number) {
  return `${fmtDec2(v)}%`;
}

// 符号付きで小数点第三位を切り捨てて第二位まで表示する（バフ効果の加算/乗算差分用）。
function fmtSigned(v: number): string {
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  const abs = truncate2(Math.abs(v));
  return `${sign}${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// 符号なしの整数として切り捨てて表示する（バフ効果の初期値/ステ変換値列用）。
function fmtIntTrunc(v: number): string {
  return Math.floor(v).toLocaleString();
}

export default function StatsDetailDialog({ onClose }: StatsDetailDialogProps) {
  const { t } = useTranslation();

  const { rawStats, rawStatsBreakdown, stats, derivedStats } = useBuildStore(
    useShallow(computeStatsBundle),
  );

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

  // 物理/魔法攻撃力はメインステータスから、最大HPは耐久力から、物理防御力は筋力から、
  // 魔法防御力は知力から、ファストは俊敏から変換された分を、素の値(entry.base)と
  // 同様に加算列の末尾へ初期値扱いの括弧書きで表示する。
  const conversionBonusFor = (statId: StatId): number => {
    if (statId === 'atk') return derivedStats.physicalAtkMainStatBonus;
    if (statId === 'matk') return derivedStats.magicalAtkMainStatBonus;
    if (statId === 'maxHp') return derivedStats.enduranceMaxHpBonus;
    if (statId === 'physicalDef') return derivedStats.physicalDefStrengthBonus;
    if (statId === 'magicalDef') return derivedStats.magicalDefIntellectBonus;
    if (statId === 'haste') return derivedStats.hasteAgilityBonus;
    return 0;
  };

  // バフ効果: 素の値(BASE_STATS)から加算/乗算/料理バフのいずれかで変化しているステータス、
  // および物理/魔法攻撃力・最大HP・物理/魔法防御力・ファスト(メインステータスからの変換分がある場合)を抽出。
  const buffRows = (Object.keys(rawStatsBreakdown) as StatId[])
    .filter((statId) => {
      const entry = rawStatsBreakdown[statId];
      return (
        entry.additive !== 0 ||
        entry.multiplier !== 1 ||
        !!entry.cookingBonus ||
        conversionBonusFor(statId) !== 0
      );
    })
    .map((statId) => {
      const entry = rawStatsBreakdown[statId];
      if (statId === 'critRecoveryBonus') {
        // 会心回復ボーナス: raw値自体には意味がないため、%変換した値を他ステータスの追加バフ
        // (最終%への直接加算)と同じ扱いで追加バフ列にまとめて表示する。
        const totalPercent = (entry.additive + (entry.cookingBonus ?? 0)) / 100;
        return {
          statId,
          label: t(`buildPlanner.stats.${statId}`),
          initialValue: '',
          additive: '',
          multiplier: '',
          cookingBuff: totalPercent !== 0 ? `${fmtSigned(totalPercent)}%` : '',
        };
      }
      const initialValue = entry.base + conversionBonusFor(statId);
      return {
        statId,
        label: t(`buildPlanner.stats.${statId}`),
        initialValue: initialValue > 0 ? fmtIntTrunc(initialValue) : '',
        additive: fmtSigned(entry.additive),
        multiplier: entry.multiplier === 1 ? '' : `${fmtSigned((entry.multiplier - 1) * 100)}%`,
        cookingBuff: entry.cookingBonus
          ? FINAL_PCT_ADDEND_STAT_IDS.has(statId)
            ? `${fmtSigned(entry.cookingBonus)}%`
            : fmtSigned(entry.cookingBonus)
          : '',
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

  // 属性攻撃力(防御力を無視して防御減衰後に加算される、精錬攻撃力と同種の追加攻撃力):
  // 全属性攻撃力(装着効果・モジュール由来) + その属性固有の攻撃力(クラスアビリティの
  // 小ノード由来)の合計を、各属性の実効値として表示する。
  const elemAtkRows = ELEMENTS.map((elem) => ({
    label: elemName(elem, 'atk'),
    value: fmtDec2(
      elem === 'all' ? rawStats.allAttrAtk : rawStats.allAttrAtk + rawStats[ELEMENT_ATK_STAT[elem]],
    ),
  }));

  // 属性強度→属性ボーナス%(系列C、物理/魔法増強と同じ収益逓減カーブ)。全属性強度は
  // 全属性に共通して乗り、シロップ/脊椎試薬は選択中の属性のみに実数加算される
  // (calculateRawStats側でaddStat済みのfireAttrStr等に反映されている)。
  const elemStrFor = (elem: ElementId): number =>
    rawStats.allAttrStr + rawStats[ELEMENT_ATTR_STR_STAT[elem]];
  const elemBonusPercent = (str: number): number =>
    diminishingPercent(str, SEASON_CONSTANTS.diminishingEnhance);

  const elemBonusRows: { label: string; value: string }[] = [
    { label: elemName('all', 'str'), value: fmtDec2(rawStats.allAttrStr) },
    { label: elemName('all', 'bonus'), value: fmtPct(elemBonusPercent(rawStats.allAttrStr)) },
    ...ELEMENTS.slice(1).flatMap((elem) => {
      const str = elemStrFor(elem as ElementId);
      return [
        { label: elemName(elem, 'str'), value: fmtDec2(str) },
        { label: elemName(elem, 'bonus'), value: fmtPct(elemBonusPercent(str)) },
      ];
    }),
  ];

  // 属性耐性→属性軽減%(系列C)。属性別の耐性ソースは現状ゲームデータに存在しないため、
  // 全属性耐性の値が全属性に共通して適用される。
  const elemReductionPercent = diminishingPercent(
    rawStats.allAttrResist,
    SEASON_CONSTANTS.diminishingEnhance,
  );
  const elemResistRows: { label: string; value: string }[] = [
    { label: elemName('all', 'resist'), value: fmtDec2(rawStats.allAttrResist) },
    { label: elemName('all', 'reduction'), value: fmtPct(elemReductionPercent) },
    ...ELEMENTS.slice(1).flatMap((elem) => [
      { label: elemName(elem, 'resist'), value: fmtDec2(rawStats.allAttrResist) },
      { label: elemName(elem, 'reduction'), value: fmtPct(elemReductionPercent) },
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
      initialSize={{ w: 540, h: 540 }}
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
                    <th className="stats-detail__value">{te('buffEffects.initialValue')}</th>
                    <th className="stats-detail__value">{te('buffEffects.additive')}</th>
                    <th className="stats-detail__value">{te('buffEffects.multiplier')}</th>
                    <th className="stats-detail__value">{te('buffEffects.cookingBuff')}</th>
                  </tr>
                </thead>
                <tbody>
                  {buffRows.map((row) => (
                    <tr key={row.statId} className="stats-detail__row">
                      <td className="stats-detail__label">{row.label}</td>
                      <td className="stats-detail__value">{row.initialValue}</td>
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
