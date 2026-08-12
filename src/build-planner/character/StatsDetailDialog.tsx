import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import '../components/components.css';
import './character.css';
import { CollapsibleBody } from '../components/CollapsibleSection';
import DraggableDialog from '../components/DraggableDialog';
import { PROFESSIONS } from '../profession';
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

// 会心/ファスト/幸運/器用さ/万能/物理増強/魔法増強: cookingBonusが最終%表示値への直接加算
// (単位: %そのまま)のため、追加バフ列では他ステータス(実数加算)と異なり%表記で表示する。
// 物理/魔法増強はRAW_PERCENT_STAT_IDSには含めない(rawStats.physicalEnhance等は会心/ファスト
// 等と同じ収益逓減カーブ前提のレーティングであり、cookingBonus側だけがカーブ後の最終%への
// 直接加算(蒼海武器等のfinalPctAddend由来)という異なる単位のため。2026-08-12不具合報告の
// 反省を踏まえ、バフ効果テーブルではレーティングとしての内訳(加算元)表示に統一する。カーブ
// 変換後の最終%は「攻撃ステータス」セクションの物理/魔法増強行で確認できる)。
const FINAL_PCT_ADDEND_STAT_IDS = new Set<StatId>([
  'crit',
  'haste',
  'luck',
  'mastery',
  'versatility',
  'physicalEnhance',
  'magicalEnhance',
]);

// バフ効果テーブルの汎用ループ(Object.keys(rawStatsBreakdown)、buildPlanner.stats.*の汎用名を
// 使う)から除外し、専用ラベルで手動組み立てする(下記buildRow/elemStrengthRow参照)StatId。
// - physicalEnhance/magicalEnhance: 装備選択等でも使う汎用名「物理増強」と表記を分けるため。
// - 属性強度(fireAttrStr等)・属性ボーナス(fireBonus等): 収益逓減カーブ前提のレーティング
//   (属性強度)とカーブを経由しない直接加算(属性ボーナス)を「属性強度/ボーナス」の1行に
//   合成するため(elemStrengthRow参照)。
const CUSTOM_LABEL_STAT_IDS = new Set<StatId>([
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
  const professionKey = useBuildStore((s) => s.professionKey);
  const profession = PROFESSIONS[professionKey];
  // 幸運の一撃回復の倍率は現状ヴァーダントオラクル/ビートパフォーマー(支援寄りの回復スキルを
  // 持つクラス)でのみ意味を持つため、この2クラスの場合のみ表示する。
  const isLuckyHitRecoveryRelevant =
    professionKey === 'verdantOracle' || professionKey === 'beatPerformer';

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
  // 会心ダメージ/幸運の一撃ダメージ倍率・回復倍率/会心回復/戦闘時スタミナ回復は、装備等の
  // 加算元がない固定の基礎値(FIXED_BASE_PERCENT/profession.staminaRegenPerSecond)を持つため、
  // ここで初期値として加える(2026-08-09/2026-08-13不具合報告: これらの「初期値/ステ変換値」が
  // 常に空欄だった)。幸運の一撃ダメージ/回復倍率は基礎40%のみを返し、幸運確率由来の変換分は
  // luckyConversionForで別途「加算」列側に出す(2026-08-13 UI改善: 従来は基礎+変換分を
  // まとめてここに含めていたため、幸運確率由来の加算分が「加算」列に出てこなかった)。
  const conversionBonusFor = (statId: StatId): number => {
    if (statId === 'atk') return derivedStats.physicalAtkMainStatBonus;
    if (statId === 'matk') return derivedStats.magicalAtkMainStatBonus;
    if (statId === 'maxHp') return derivedStats.enduranceMaxHpBonus;
    if (statId === 'physicalDef') return derivedStats.physicalDefStrengthBonus;
    if (statId === 'magicalDef') return derivedStats.magicalDefIntellectBonus;
    if (statId === 'haste') return derivedStats.hasteAgilityBonus;
    if (statId === 'critDamageBonus') return FIXED_BASE_PERCENT.critDamage * 100;
    if (statId === 'critRecoveryBonus') return FIXED_BASE_PERCENT.critRecovery * 100;
    if (statId === 'luckyHitDamageBonus' || statId === 'luckyHitRecoveryBonus') {
      return FIXED_BASE_PERCENT.luckyHitBase * 100;
    }
    if (statId === 'staminaRegen') return profession.staminaRegenPerSecond;
    return 0;
  };

  // 幸運の一撃ダメージ/回復倍率のうち、幸運確率(最終%値)を元に加算される分(raw/100=%単位)。
  // derivedStatsの最終値から、基礎40%とrawStats側の平坦加算(通常の加算列)を差し引いた残り。
  const luckyConversionFor = (statId: StatId): number => {
    if (statId === 'luckyHitDamageBonus') {
      return (
        derivedStats.luckyHitDamageMultiplierPercent * 100 -
        FIXED_BASE_PERCENT.luckyHitBase * 100 -
        rawStats.luckyHitDamageBonus
      );
    }
    if (statId === 'luckyHitRecoveryBonus') {
      return (
        derivedStats.luckyHitRecoveryMultiplierPercent * 100 -
        FIXED_BASE_PERCENT.luckyHitBase * 100 -
        rawStats.luckyHitRecoveryBonus
      );
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
    total: string;
  }

  // 行を出すべきか(素の値から加算/乗算/料理バフ/ステ変換/レベル加算/幸運確率変換分の
  // いずれかで変化しているか)。
  const hasBuffContribution = (statId: StatId): boolean => {
    const entry = rawStatsBreakdown[statId];
    return (
      entry.additive !== 0 ||
      entry.multiplier !== 1 ||
      !!entry.cookingBonus ||
      !!entry.levelBonus ||
      conversionBonusFor(statId) !== 0 ||
      luckyConversionFor(statId) !== 0
    );
  };

  // 合計列: 会心/幸運/会心ダメージ等は収益逓減カーブ(+基礎%)通過後の最終%(derivedStats)、
  // 筋力/知力等の実数値ステータスは加算元の内訳と同じ単位の合計(rawStats、maxHp/atk等は
  // メインステータス変換込みのstats)をそのまま表示する。
  const DERIVED_PERCENT_STAT: Partial<Record<StatId, number>> = {
    crit: derivedStats.critPercent,
    haste: derivedStats.hastePercent,
    luck: derivedStats.luckPercent,
    mastery: derivedStats.masteryPercent,
    versatility: derivedStats.versatilityPercent,
    resist: derivedStats.resistPercent,
    critDamageBonus: derivedStats.critDamageBonusPercent,
    luckyHitDamageBonus: derivedStats.luckyHitDamageMultiplierPercent,
    critRecoveryBonus: derivedStats.critRecoveryPercent,
    luckyHitRecoveryBonus: derivedStats.luckyHitRecoveryMultiplierPercent,
    physicalReductionBonus: derivedStats.physicalReductionPercent,
    magicalReductionBonus: derivedStats.magicalReductionPercent,
    physicalDefIgnoreBonus: derivedStats.physicalDefIgnorePercent,
    physicalEnhance: derivedStats.physicalBoostPercent,
    magicalEnhance: derivedStats.magicalBoostPercent,
  };
  // %変換を経ない実数値ステータスのうち、rawStatsそのものではなくメインステータス変換込みの
  // 最終値(stats)・戦闘時スタミナ回復のような別枠のderivedStats値を使うもの。
  const FINAL_RAW_STAT_OVERRIDE: Partial<Record<StatId, number>> = {
    maxHp: stats.maxHp,
    atk: stats.atk,
    matk: stats.matk,
    physicalDef: stats.physicalDef,
    magicalDef: stats.magicalDef,
    staminaRegen: derivedStats.staminaRegenPerSecond,
  };
  const totalFor = (statId: StatId): string => {
    const pct = DERIVED_PERCENT_STAT[statId];
    if (pct !== undefined) return fmtPct(pct);
    if (RAW_PERCENT_STAT_IDS.has(statId)) return fmtPct(rawStats[statId] / 100);
    const override = FINAL_RAW_STAT_OVERRIDE[statId];
    return fmtDec2(override !== undefined ? override : rawStats[statId]);
  };

  // rawStatsBreakdownの1エントリを表示行に変換する(汎用ループ・専用ラベル行の両方で共用)。
  const buildRow = (statId: StatId, label: string): BuffRow => {
    const entry = rawStatsBreakdown[statId];
    const isRawPercent = RAW_PERCENT_STAT_IDS.has(statId);
    const initialValue = entry.base + (entry.levelBonus ?? 0) + conversionBonusFor(statId);
    return {
      statId,
      label,
      initialValue:
        initialValue > 0
          ? isRawPercent
            ? `${fmtDec2(initialValue / 100)}%`
            : fmtIntTrunc(initialValue)
          : '',
      additive: isRawPercent
        ? `${fmtSigned((entry.additive + luckyConversionFor(statId)) / 100)}%`
        : fmtSigned(entry.additive),
      multiplier: entry.multiplier === 1 ? '' : `${fmtSigned((entry.multiplier - 1) * 100)}%`,
      cookingBuff: entry.cookingBonus
        ? FINAL_PCT_ADDEND_STAT_IDS.has(statId)
          ? `${fmtSigned(entry.cookingBonus)}%`
          : isRawPercent
            ? `${fmtSigned(entry.cookingBonus / 100)}%`
            : fmtSigned(entry.cookingBonus)
        : '',
      total: totalFor(statId),
    };
  };

  // バフ効果: 素の値(BASE_STATS)から加算/乗算/料理バフのいずれかで変化しているステータス、
  // および物理/魔法攻撃力・最大HP・物理/魔法防御力・ファスト(メインステータスからの変換分がある場合)を抽出。
  // 専用ラベルで手動組み立てするステータス(CUSTOM_LABEL_STAT_IDS)、および表の先頭/末尾や
  // 会心回復の直後等、特定の位置へ個別に並べ替えるステータス(illusionPower/staminaRegen/
  // moveSpeed/luckyHitRecoveryBonus)はここでは除外する(下記参照)。
  const EXTRA_CUSTOM_POSITION_STAT_IDS = new Set<StatId>([
    'illusionPower',
    'staminaRegen',
    'moveSpeed',
    'luckyHitRecoveryBonus',
  ]);
  const buildGenericRows = (statIds: StatId[]): BuffRow[] =>
    statIds
      .filter(
        (statId) =>
          !EXTRA_CUSTOM_POSITION_STAT_IDS.has(statId) &&
          !CUSTOM_LABEL_STAT_IDS.has(statId) &&
          hasBuffContribution(statId),
      )
      .map((statId) => buildRow(statId, t(`buildPlanner.stats.${statId}`)));

  // シーズン強度(S3では「滅妄強度」)は他の全ステータスより上、表の先頭に表示する。
  const illusionPowerRow = hasBuffContribution('illusionPower')
    ? buildRow('illusionPower', t('buildPlanner.stats.illusionPower'))
    : null;

  // 戦闘時のスタミナ回復率は他の全ステータスより下、表の末尾に表示する。クラス基礎値のみで
  // 加算元(瞬間ブレス等)が無い場合は合計=初期値になり出す意味が薄いため、その場合は非表示。
  const staminaRegenRow =
    (rawStatsBreakdown.staminaRegen.additive ?? 0) !== 0
      ? buildRow('staminaRegen', t('buildPlanner.stats.staminaRegen'))
      : null;

  // 移動速度は戦闘時のスタミナ回復率のさらに下、表の最末尾に表示する。
  const moveSpeedRow = hasBuffContribution('moveSpeed')
    ? buildRow('moveSpeed', t('buildPlanner.stats.moveSpeed'))
    : null;

  // 幸運の一撃回復の倍率: 会心回復の直下に表示する(下のbuffRows参照)。初期値40%・幸運確率
  // 由来の加算はluckyHitダメージ倍率と同じ扱い(conversionBonusFor/luckyConversionFor)。
  const luckyHitRecoveryRow = isLuckyHitRecoveryRelevant
    ? buildRow('luckyHitRecoveryBonus', t('buildPlanner.stats.luckyHitRecoveryBonus'))
    : null;

  const allStatIds = Object.keys(rawStatsBreakdown) as StatId[];
  const elemAtkStartIndex = allStatIds.indexOf('allAttrAtk');
  const elemAtkEndIndex = allStatIds.indexOf('darkAtk');
  const refineDefIndex = allStatIds.indexOf('refineDef');
  // BASE_STATS上は筋力→俊敏→知力の順だが、表示は筋力→知力→俊敏にする。
  const MAIN_STAT_ORDER: StatId[] = ['strength', 'intellect', 'agility'];
  const beforeElemAtkIds = allStatIds.slice(0, elemAtkStartIndex);
  const strengthIndex = beforeElemAtkIds.indexOf('strength');
  const reorderedBeforeElemAtkIds = [
    ...beforeElemAtkIds.slice(0, strengthIndex),
    ...MAIN_STAT_ORDER,
    ...beforeElemAtkIds.slice(strengthIndex).filter((id) => !MAIN_STAT_ORDER.includes(id)),
  ];
  const genericBuffRowsBeforeElemAtk = buildGenericRows(reorderedBeforeElemAtkIds);
  // 属性攻撃力グループの直後から精錬(refineDef)までには属性強度(fireAttrStr等、
  // CUSTOM_LABEL_STAT_IDSで除外済み)も含まれるが、実際に行になるのは精錬のみ。
  const genericBuffRowsRefine = buildGenericRows(
    allStatIds.slice(elemAtkEndIndex + 1, refineDefIndex + 1),
  );
  const genericBuffRowsElemAtk = buildGenericRows(
    allStatIds.slice(elemAtkStartIndex, elemAtkEndIndex + 1),
  );
  // 会心回復(critRecoveryBonus)の直後に幸運の一撃回復の倍率(luckyHitRecoveryRow)を挟むため、
  // 精錬より後ろのステータスを会心回復までとそれ以降の2つに分ける。
  const afterRefineIds = allStatIds.slice(refineDefIndex + 1);
  const critRecoveryIndex = afterRefineIds.indexOf('critRecoveryBonus');
  const genericBuffRowsUntilCritRecovery = buildGenericRows(
    afterRefineIds.slice(0, critRecoveryIndex + 1),
  );
  const genericBuffRowsAfterCritRecovery = buildGenericRows(
    afterRefineIds.slice(critRecoveryIndex + 1),
  );

  // 物理/魔法増強: 会心/ファスト等と同じレーティング(強化度)として、初期値/加算/乗算列に
  // 加算元の内訳を表示する(装備選択等でも使う汎用名「物理増強」と区別するため専用ラベルを使う)。
  const enhanceBuffRows: BuffRow[] = (
    [
      ['physicalEnhance', te('stat.physicalEnhanceBuff')],
      ['magicalEnhance', te('stat.magicalEnhanceBuff')],
    ] as [StatId, string][]
  )
    .filter(([statId]) => hasBuffContribution(statId))
    .map(([statId, label]) => buildRow(statId, label));

  // 属性強度(fireAttrStr等、収益逓減カーブ前提のレーティング)と属性ボーナス(fireBonus等、
  // カーブを経由しない直接加算、蒼海武器レアステータス・バトルイマジン等由来)を1行に合成する。
  // 初期値/加算/乗算は属性強度側(他のレーティング系ステータスと同じ扱い)、追加バフ列は
  // 属性ボーナス側("raw/100=%"規約、RAW_PERCENT_STAT_IDS)を表示する。
  const elemStrengthRow = (
    strStatId: StatId,
    bonusStatId: StatId | undefined,
    label: string,
  ): BuffRow | null => {
    const strEntry = rawStatsBreakdown[strStatId];
    const bonusEntry = bonusStatId ? rawStatsBreakdown[bonusStatId] : undefined;
    const directPercent = bonusEntry
      ? (bonusEntry.additive + (bonusEntry.cookingBonus ?? 0)) / 100
      : 0;
    if (!hasBuffContribution(strStatId) && directPercent === 0) return null;
    const initialValue = strEntry.base + conversionBonusFor(strStatId);
    return {
      statId: strStatId,
      label,
      initialValue: initialValue > 0 ? fmtIntTrunc(initialValue) : '',
      additive: fmtSigned(strEntry.additive),
      multiplier: strEntry.multiplier === 1 ? '' : `${fmtSigned((strEntry.multiplier - 1) * 100)}%`,
      cookingBuff: directPercent !== 0 ? `${fmtSigned(directPercent)}%` : '',
      total: fmtPct(elemBonusPercent(rawStats[strStatId]) + directPercent),
    };
  };

  const elemBuffRows: BuffRow[] = [
    elemStrengthRow('allAttrStr', undefined, elemName('all', 'strBonus')),
    ...ELEMENTS.slice(1).map((elem) => {
      const e = elem as ElementId;
      return elemStrengthRow(ELEMENT_ATTR_STR_STAT[e], ELEMENT_BONUS_STAT[e], elemName(e, 'strBonus'));
    }),
  ].filter((row): row is BuffRow => row !== null);

  const buffRows = [
    ...(illusionPowerRow ? [illusionPowerRow] : []),
    ...genericBuffRowsBeforeElemAtk,
    ...genericBuffRowsRefine,
    ...genericBuffRowsElemAtk,
    ...elemBuffRows,
    ...enhanceBuffRows,
    ...genericBuffRowsUntilCritRecovery,
    ...(luckyHitRecoveryRow ? [luckyHitRecoveryRow] : []),
    ...genericBuffRowsAfterCritRecovery,
    ...(staminaRegenRow ? [staminaRegenRow] : []),
    ...(moveSpeedRow ? [moveSpeedRow] : []),
  ];

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

  // elemBonusPercent/elemDirectBonusPercent(カーブ変換後の最終%表示用)は
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
      initialSize={{ w: 648, h: 540 }}
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
                    <th className="stats-detail__value">{te('buffEffects.total')}</th>
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
                        <td className="stats-detail__value">{row.total}</td>
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
