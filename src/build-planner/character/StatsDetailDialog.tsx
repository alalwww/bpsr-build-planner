import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import '../components/components.css';
import './character.css';
import { CollapsibleBody } from '../components/CollapsibleSection';
import DraggableDialog from '../components/DraggableDialog';
import { ELEMENT_IDS, type ElementId, type StatId } from '../types';
import {
  ELEMENT_ATK_STAT,
  ELEMENT_ATTR_STR_STAT,
  ELEMENT_BONUS_STAT,
  RAW_PERCENT_STAT_IDS,
} from '../stats/attrMaps';
import { diminishingPercent } from '../stats/formulas';
import { FIXED_BASE_PERCENT, FIXED_BASE_VALUE, SEASON_CONSTANTS } from '../stats/seasonConstants';
import { computeStatsBundle } from '../store/derivedSelectors';
import { useBuildStore } from '../store/useBuildStore';
import { truncate2, truncate2Str as fmtDec2 } from './statFormat';

interface StatsDetailDialogProps {
  onClose: () => void;
  /** OSネイティブウィンドウ(stats-detail.html)内での表示か。既定 false。 */
  windowed?: boolean;
}

const ELEMENTS = ['all', ...ELEMENT_IDS] as const;

// 会心/ファスト/幸運/器用さ/万能: cookingBonusが最終%表示値への直接加算(単位: %そのまま)のため、
// 追加バフ列では他ステータス(実数加算)と異なり%表記で表示する。
// 物理/魔法増強・属性ボーナスも同種の直接加算(蒼海武器等のfinalPctAddend由来)を持つが、
// 対応するraw StatId(physicalEnhance/magicalEnhance/各属性強度)自体はCURVE_PRECURSOR_STAT_IDS
// によりバフ効果テーブルの汎用ループから除外し、代わりに手動で組み立てた合成行(下記
// curveBoostRow参照)で表示するため、このSetには含めない(2026-08-12不具合報告: 収益逓減
// カーブを経由する実数値をisRawPercentの/100変換だけで%表示すると、実際の変換結果と
// 一致しない誤った値になる)。
const FINAL_PCT_ADDEND_STAT_IDS = new Set<StatId>([
  'crit',
  'haste',
  'luck',
  'mastery',
  'versatility',
]);

// 収益逓減カーブ(diminishingPercent)を経由する実数値のraw StatId。実数値そのものをバフ効果
// テーブルの汎用ループで/100してもカーブ変換後の実際の%とは一致しないため除外し、代わりに
// curveBoostRowで「カーブ変換後の%(加算列)」+「カーブを経由しない直接加算分(追加バフ列)」の
// 合成行として表示する(物理/魔法増強・属性ボーナス。2026-08-12不具合報告)。
const CURVE_PRECURSOR_STAT_IDS = new Set<StatId>([
  'physicalEnhance',
  'magicalEnhance',
  'allAttrStr',
  'fireAttrStr',
  'iceAttrStr',
  'forestAttrStr',
  'thunderAttrStr',
  'windAttrStr',
  'rockAttrStr',
  'lightAttrStr',
  'darkAttrStr',
  'fireBonus',
  'iceBonus',
  'forestBonus',
  'thunderBonus',
  'windBonus',
  'rockBonus',
  'lightBonus',
]);

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

// StatsDetailDialog内で使う折り畳みセクション。親コンポーネント内で定義すると
// レンダーごとに関数の同一性が変わりReactがDOMを再マウントしてしまい、
// CollapsibleBodyのCSSトランジションが効かなくなるため、モジュールスコープに分離する。
function Section({
  isOpen,
  onToggle,
  label,
  rows,
  sectionKey,
  selectedRows,
  onRowClick,
}: {
  isOpen: boolean;
  onToggle: () => void;
  label: string;
  rows: { label: string; value: string }[];
  sectionKey: string;
  selectedRows: Set<string>;
  onRowClick: (key: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="stats-detail__section">
      <button type="button" className="stats-detail__section-header" onClick={onToggle}>
        <span className="stats-detail__section-arrow">{isOpen ? '▼' : '▶'}</span>
        {label}
      </button>
      <CollapsibleBody open={isOpen}>
        <table className="stats-detail__table">
          <tbody>
            {rows.map((row) => {
              const rowKey = `${sectionKey}:${row.label}`;
              return (
                <tr
                  key={row.label}
                  className={`stats-detail__row${selectedRows.has(rowKey) ? ' stats-detail__row--selected' : ''}`}
                  onClick={() => onRowClick(rowKey)}
                >
                  <td className="stats-detail__label">{row.label}</td>
                  <td className="stats-detail__value">{row.value}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CollapsibleBody>
    </div>
  );
}

export default function StatsDetailDialog({ onClose, windowed = false }: StatsDetailDialogProps) {
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

  // クリックした行を強調表示するための選択状態(複数行を同時選択可)。キーは
  // "セクションキー:ラベル"の組み合わせで、セクションをまたいだラベルの重複を避ける。
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const toggleRow = (key: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const te = (key: string) => t(`buildPlanner.detailStats.${key}`);
  const elemName = (elem: string, suffix: string) =>
    `${te(`elem.${elem}`)}${te(`elemSuffix.${suffix}`)}`;

  // 物理/魔法攻撃力はメインステータスから、最大HPは耐久力から、物理防御力は筋力から、
  // 魔法防御力は知力から、ファストは俊敏から変換された分を、素の値(entry.base)と
  // 同様に加算列の末尾へ初期値扱いの括弧書きで表示する。
  // 会心ダメージ/幸運の一撃ダメージ倍率は、装備等の加算元がない基礎%(FIXED_BASE_PERCENT)や
  // 幸運%からの変換分がRAW_PERCENT_STAT_IDS表示(実数値/100=%)の単位に乗るよう、あらかじめ
  // 100倍して返す(2026-08-09不具合報告: これらの「初期値/ステ変換値」が常に空欄だった)。
  const conversionBonusFor = (statId: StatId): number => {
    if (statId === 'atk') return derivedStats.physicalAtkMainStatBonus;
    if (statId === 'matk') return derivedStats.magicalAtkMainStatBonus;
    if (statId === 'maxHp') return derivedStats.enduranceMaxHpBonus;
    if (statId === 'physicalDef') return derivedStats.physicalDefStrengthBonus;
    if (statId === 'magicalDef') return derivedStats.magicalDefIntellectBonus;
    if (statId === 'haste') return derivedStats.hasteAgilityBonus;
    if (statId === 'critDamageBonus') return FIXED_BASE_PERCENT.critDamage * 100;
    if (statId === 'luckyHitDamageBonus') {
      // 幸運の一撃ダメージ倍率(derivedStats、装備等の加算込みの最終値)から、その加算分
      // (rawStats.luckyHitDamageBonus)を差し引き、基礎40%+幸運%からの変換分のみを残す。
      return derivedStats.luckyHitDamageMultiplierPercent * 100 - rawStats.luckyHitDamageBonus;
    }
    return 0;
  };

  // 属性強度→属性ボーナス%(系列C、物理/魔法増強と同じ収益逓減カーブ)。全属性強度も
  // 特定の属性には効果を発揮せず「全属性」枠のみに乗るため、個別属性の行はその属性固有の
  // 強度(シロップ/脊椎試薬等でcalculateRawStats側でaddStat済みのfireAttrStr等)のみ。
  const elemBonusPercent = (str: number): number =>
    diminishingPercent(str, SEASON_CONSTANTS.diminishingEnhance);

  // 属性ボーナス%への直接加算(蒼海武器レアステータス等、収益逓減カーブを経由しない
  // "実数値/100=%"のrawStats項目)。闇属性は対応するAttrIdがなく常に0。
  const elemDirectBonusPercent = (elem: ElementId): number => {
    const statId = ELEMENT_BONUS_STAT[elem];
    return statId ? rawStats[statId] / 100 : 0;
  };

  interface BuffRow {
    statId: string;
    label: string;
    initialValue: string;
    additive: string;
    multiplier: string;
    cookingBuff: string;
  }

  // 収益逓減カーブを経由するステータス(物理/魔法増強・属性ボーナス)用の合成行。
  // 加算列=カーブ変換後の%(強化薬/属性強度等の実数値由来)、追加バフ列=カーブを経由しない
  // 直接加算分(蒼海武器レアステータス等由来)。どちらも0の場合は行自体を出さない。
  const curveBoostRow = (
    statId: string,
    label: string,
    curveValue: number,
    directValue: number,
  ): BuffRow | null => {
    if (curveValue === 0 && directValue === 0) return null;
    return {
      statId,
      label,
      initialValue: '',
      additive: curveValue !== 0 ? `${fmtSigned(curveValue)}%` : '',
      multiplier: '',
      cookingBuff: directValue !== 0 ? `${fmtSigned(directValue)}%` : '',
    };
  };

  // バフ効果: 素の値(BASE_STATS)から加算/乗算/料理バフのいずれかで変化しているステータス、
  // および物理/魔法攻撃力・最大HP・物理/魔法防御力・ファスト(メインステータスからの変換分がある場合)を抽出。
  // 収益逓減カーブを経由するraw StatId(CURVE_PRECURSOR_STAT_IDS)は実数値のままでは意味を
  // 持たないため除外し、代わりにcurveBoostRowによる合成行(下記)で表示する。
  const genericBuffRows: BuffRow[] = (Object.keys(rawStatsBreakdown) as StatId[])
    .filter((statId) => {
      if (CURVE_PRECURSOR_STAT_IDS.has(statId)) return false;
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
      const isRawPercent = RAW_PERCENT_STAT_IDS.has(statId);
      const initialValue = entry.base + conversionBonusFor(statId);
      return {
        statId,
        label: t(`buildPlanner.stats.${statId}`),
        initialValue:
          initialValue > 0
            ? isRawPercent
              ? `${fmtDec2(initialValue / 100)}%`
              : fmtIntTrunc(initialValue)
            : '',
        additive: isRawPercent ? `${fmtSigned(entry.additive / 100)}%` : fmtSigned(entry.additive),
        multiplier: entry.multiplier === 1 ? '' : `${fmtSigned((entry.multiplier - 1) * 100)}%`,
        cookingBuff: entry.cookingBonus
          ? FINAL_PCT_ADDEND_STAT_IDS.has(statId)
            ? `${fmtSigned(entry.cookingBonus)}%`
            : isRawPercent
              ? `${fmtSigned(entry.cookingBonus / 100)}%`
              : fmtSigned(entry.cookingBonus)
          : '',
      };
    });

  // 物理/魔法増強: 強化薬(スターオイル)等の実数値がカーブを経由して得られる%を加算列、
  // 蒼海武器等のfinalPctAddend由来の直接加算分(derivedStats側の最終値からカーブ変換分を
  // 差し引いた残り)を追加バフ列に表示する。
  const physicalEnhanceCurve = elemBonusPercent(rawStats.physicalEnhance);
  const magicalEnhanceCurve = elemBonusPercent(rawStats.magicalEnhance);
  const curveBuffRows: BuffRow[] = [
    curveBoostRow(
      'physicalBoostCurve',
      te('stat.physicalBoost'),
      physicalEnhanceCurve,
      derivedStats.physicalBoostPercent - physicalEnhanceCurve,
    ),
    curveBoostRow(
      'magicalBoostCurve',
      te('stat.magicalBoost'),
      magicalEnhanceCurve,
      derivedStats.magicalBoostPercent - magicalEnhanceCurve,
    ),
    curveBoostRow(
      'elemBonusAllCurve',
      elemName('all', 'bonus'),
      elemBonusPercent(rawStats.allAttrStr),
      0,
    ),
    ...ELEMENTS.slice(1).map((elem) => {
      const e = elem as ElementId;
      const str = rawStats[ELEMENT_ATTR_STR_STAT[e]];
      return curveBoostRow(
        `elemBonus:${elem}Curve`,
        elemName(elem, 'bonus'),
        elemBonusPercent(str),
        elemDirectBonusPercent(e),
      );
    }),
  ].filter((row): row is BuffRow => row !== null);

  const buffRows = [...genericBuffRows, ...curveBuffRows];

  const attackRows = [
    { label: te('stat.strength'), value: fmtDec2(rawStats.strength) },
    { label: te('stat.intellect'), value: fmtDec2(rawStats.intellect) },
    { label: te('stat.agility'), value: fmtDec2(rawStats.agility) },
    { label: te('stat.physicalAtk'), value: fmtDec2(stats.atk) },
    { label: te('stat.magicalAtk'), value: fmtDec2(stats.matk) },
    { label: te('stat.refinedPhysAtk'), value: fmtDec2(rawStats.refinePhysAtk) },
    { label: te('stat.refinedMagAtk'), value: fmtDec2(rawStats.refineMagAtk) },
    { label: te('stat.physicalEnhance'), value: fmtDec2(rawStats.physicalEnhance) },
    { label: te('stat.physicalBoost'), value: fmtPct(derivedStats.physicalBoostPercent) },
    { label: te('stat.magicalEnhance'), value: fmtDec2(rawStats.magicalEnhance) },
    { label: te('stat.magicalBoost'), value: fmtPct(derivedStats.magicalBoostPercent) },
    { label: te('stat.atkSpeed'), value: fmtPct(derivedStats.atkSpeedPercent) },
    { label: te('stat.castSpeed'), value: fmtPct(derivedStats.castSpeedPercent) },
    { label: te('stat.critDamage'), value: fmtPct(derivedStats.critDamageBonusPercent) },
    {
      label: te('stat.luckyHitDamage'),
      value: fmtPct(derivedStats.luckyHitDamageMultiplierPercent),
    },
    ...(derivedStats.physicalDefIgnorePercent > 0
      ? [
          {
            label: te('stat.physicalDefIgnore'),
            value: fmtPct(derivedStats.physicalDefIgnorePercent),
          },
        ]
      : []),
    ...(rawStats.bossDamageBonus > 0
      ? [{ label: te('stat.bossDamageBonus'), value: fmtPct(rawStats.bossDamageBonus / 100) }]
      : []),
    ...(rawStats.breakEfficiency > 0
      ? [{ label: te('stat.breakEfficiency'), value: fmtPct(rawStats.breakEfficiency / 100) }]
      : []),
  ];

  const survivalRows = [
    { label: te('stat.endurance'), value: fmtDec2(rawStats.endurance) },
    { label: te('stat.maxHp'), value: fmtDec2(stats.maxHp) },
    { label: te('stat.physicalDef'), value: fmtDec2(stats.physicalDef) },
    { label: te('stat.magicalDef'), value: fmtDec2(stats.magicalDef) },
    { label: te('stat.refinedDef'), value: fmtDec2(rawStats.refineDef) },
    { label: te('stat.physicalReduction'), value: fmtPct(derivedStats.physicalReductionPercent) },
    { label: te('stat.magicalReduction'), value: fmtPct(derivedStats.magicalReductionPercent) },
    {
      label: te('stat.resistDamageReduction'),
      value: fmtPct(derivedStats.resistDamageReductionPercent),
    },
    ...(rawStats.bossDamageReduction > 0
      ? [
          {
            label: te('stat.bossDamageReduction'),
            value: fmtPct(rawStats.bossDamageReduction / 100),
          },
        ]
      : []),
  ];

  const supportRows = [
    { label: te('stat.critRecovery'), value: fmtPct(derivedStats.critRecoveryPercent) },
    {
      label: te('stat.luckyHitRecovery'),
      value: fmtPct(derivedStats.luckyHitRecoveryMultiplierPercent),
    },
    { label: te('stat.healingPower'), value: fmtPct(rawStats.healingPower / 100) },
    // 潜在因子データ(phantom-factors.json)で11812(バリア強度、"100=1%")と同一グレード内に
    // 常に同スケールの数値(120〜300)で出現するため、バリア強度と同じ規約と判断しfmtPctにする。
    { label: te('stat.receivedRecovery'), value: fmtPct(rawStats.receivedRecovery / 100) },
    { label: te('stat.barrierStrength'), value: fmtPct(rawStats.barrierStrength / 100) },
    { label: te('stat.receivedBarrier'), value: fmtPct(0) },
  ];

  // 属性攻撃力(防御力を無視して防御減衰後に加算される、精錬攻撃力と同種の追加攻撃力):
  // 全属性攻撃力(装着効果・モジュール由来)は特定の属性には効果を発揮せず「全属性」枠のみに
  // 加算されるため、個別属性の行はその属性固有の攻撃力(クラスアビリティの小ノード由来)のみ。
  const elemAtkRows = ELEMENTS.map((elem) => {
    const raw = elem === 'all' ? rawStats.allAttrAtk : rawStats[ELEMENT_ATK_STAT[elem]];
    return { label: elemName(elem, 'atk'), value: fmtDec2(raw), raw };
  }).filter((row) => row.raw > 0);

  // elemBonusPercent/elemDirectBonusPercentはbuffRows(合成行)と共用のため、
  // 上のconversionBonusFor付近で定義済み。

  const elemBonusRows = [
    {
      label: elemName('all', 'str'),
      value: fmtDec2(rawStats.allAttrStr),
      raw: rawStats.allAttrStr,
    },
    {
      label: elemName('all', 'bonus'),
      value: fmtPct(elemBonusPercent(rawStats.allAttrStr)),
      raw: elemBonusPercent(rawStats.allAttrStr),
    },
    ...ELEMENTS.slice(1).flatMap((elem) => {
      const str = rawStats[ELEMENT_ATTR_STR_STAT[elem as ElementId]];
      const bonus = elemBonusPercent(str) + elemDirectBonusPercent(elem as ElementId);
      return [
        { label: elemName(elem, 'str'), value: fmtDec2(str), raw: str },
        { label: elemName(elem, 'bonus'), value: fmtPct(bonus), raw: bonus },
      ];
    }),
  ].filter((row) => row.raw > 0);

  // 属性耐性→属性軽減%(系列C)。全属性耐性も特定の属性には効果を発揮せず「全属性」枠のみに
  // 乗る。属性別の耐性ソースは現状ゲームデータに存在しないため、個別属性の行は常に0。
  // allAttrResistBonusは収益逓減カーブを経由しない直接加算(器用さのクラス×型固有効果
  // 「全属性耐性」等、ELEMENT_BONUS_STATと同じ設計)。
  const elemResistReductionPercent =
    diminishingPercent(rawStats.allAttrResist, SEASON_CONSTANTS.diminishingEnhance) +
    rawStats.allAttrResistBonus / 100;
  const elemResistRows = [
    {
      label: elemName('all', 'resist'),
      value: fmtDec2(rawStats.allAttrResist),
      raw: rawStats.allAttrResist,
    },
    {
      label: elemName('all', 'reduction'),
      value: fmtPct(elemResistReductionPercent),
      raw: elemResistReductionPercent,
    },
    // 属性別の耐性ソースは現状ゲームデータに存在しないため、個別属性の行は常に0(=常に非表示)。
    ...ELEMENTS.slice(1).flatMap((elem) => [
      { label: elemName(elem, 'resist'), value: fmtDec2(0), raw: 0 },
      { label: elemName(elem, 'reduction'), value: fmtPct(0), raw: 0 },
    ]),
  ].filter((row) => row.raw > 0);

  const miscRows = [
    { label: te('stat.maxStamina'), value: fmtDec2(FIXED_BASE_VALUE.maxStamina) },
    { label: te('stat.staminaRegen'), value: fmtDec2(derivedStats.staminaRegenPerSecond) },
    // 92000(移動速度): isPercent=falseで%換算の裏付けがないため、生の値をそのまま表示する
    // (attrMaps.ts の LEGENDARY_AFFIX_FLAT_STAT コメント参照)。
    ...(rawStats.moveSpeed > 0
      ? [{ label: te('stat.moveSpeed'), value: fmtDec2(rawStats.moveSpeed) }]
      : []),
  ];

  return (
    <DraggableDialog
      title={te('title')}
      onClose={onClose}
      className="stats-detail"
      overlay={false}
      resizable
      windowed={windowed}
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
          <CollapsibleBody open={openSections.buffEffects}>
            {buffRows.length > 0 ? (
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
                  {buffRows.map((row) => {
                    const rowKey = `buffEffects:${row.statId}`;
                    return (
                      <tr
                        key={row.statId}
                        className={`stats-detail__row${selectedRows.has(rowKey) ? ' stats-detail__row--selected' : ''}`}
                        onClick={() => toggleRow(rowKey)}
                      >
                        <td className="stats-detail__label">{row.label}</td>
                        <td className="stats-detail__value">{row.initialValue}</td>
                        <td className="stats-detail__value">{row.additive}</td>
                        <td className="stats-detail__value">{row.multiplier}</td>
                        <td className="stats-detail__value">{row.cookingBuff}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="stats-detail__empty">{te('buffEffects.empty')}</p>
            )}
          </CollapsibleBody>
        </div>
        <Section
          isOpen={openSections.attack}
          onToggle={() => toggleSection('attack')}
          label={te('sections.attack')}
          rows={attackRows}
          sectionKey="attack"
          selectedRows={selectedRows}
          onRowClick={toggleRow}
        />
        <Section
          isOpen={openSections.survival}
          onToggle={() => toggleSection('survival')}
          label={te('sections.survival')}
          rows={survivalRows}
          sectionKey="survival"
          selectedRows={selectedRows}
          onRowClick={toggleRow}
        />
        <Section
          isOpen={openSections.support}
          onToggle={() => toggleSection('support')}
          label={te('sections.support')}
          rows={supportRows}
          sectionKey="support"
          selectedRows={selectedRows}
          onRowClick={toggleRow}
        />
        <Section
          isOpen={openSections.elemAtk}
          onToggle={() => toggleSection('elemAtk')}
          label={te('sections.elemAtk')}
          rows={elemAtkRows}
          sectionKey="elemAtk"
          selectedRows={selectedRows}
          onRowClick={toggleRow}
        />
        <Section
          isOpen={openSections.elemBonus}
          onToggle={() => toggleSection('elemBonus')}
          label={te('sections.elemBonus')}
          rows={elemBonusRows}
          sectionKey="elemBonus"
          selectedRows={selectedRows}
          onRowClick={toggleRow}
        />
        <Section
          isOpen={openSections.elemResist}
          onToggle={() => toggleSection('elemResist')}
          label={te('sections.elemResist')}
          rows={elemResistRows}
          sectionKey="elemResist"
          selectedRows={selectedRows}
          onRowClick={toggleRow}
        />
        <Section
          isOpen={openSections.misc}
          onToggle={() => toggleSection('misc')}
          label={te('sections.misc')}
          rows={miscRows}
          sectionKey="misc"
          selectedRows={selectedRows}
          onRowClick={toggleRow}
        />
      </div>
    </DraggableDialog>
  );
}
