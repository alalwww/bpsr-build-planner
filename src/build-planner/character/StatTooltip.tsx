import { useTranslation } from 'react-i18next';
import FloatingTooltip from '../components/FloatingTooltip';
import LinkTextPopup from '../components/LinkTextPopup';
import { renderMarkup } from '../components/renderMarkup';
import { useLinkTextPopup } from '../components/useLinkTextPopup';
import type { StatBreakdownEntry } from '../stats/calculateRawStats';
import type { DerivedStats } from '../stats/deriveStats';
import { STAT_BASE_PERCENT, STAT_SEASON_CONSTANT } from '../stats/seasonConstants';
import type { StatId } from '../types';
import type { MainStatId, ProfessionTypeKey } from '../profession';
import { truncate2Str } from './statFormat';

export interface StatTooltipState {
  statId: StatId;
  x: number;
  y: number;
}

interface StatTooltipProps {
  state: StatTooltipState;
  rawValue: number;
  currentPercent: number;
  professionId: number;
  professionTypeKey: ProfessionTypeKey;
  derivedStats: DerivedStats;
  breakdown: Record<StatId, StatBreakdownEntry>;
  rawStats: Record<StatId, number>;
  mainStatId: MainStatId;
  onRequestClose: () => void;
}

function isBasePercentStat(id: StatId): id is keyof typeof STAT_BASE_PERCENT {
  return id in STAT_BASE_PERCENT;
}

// 最大HP/攻撃力/主要ステータス/耐久力の内訳ポップアップ設定。conversionSourceStatIdを持つもの
// (maxHp/atk/matk)は変換元ステータス(耐久力、またはクラス依存のメインステータス)の生値と
// 「変換定数」(変換元1ポイントあたりの寄与量。conversionValueを変換元の生値で割って逆算する
// ことで、能力共鳴由来の変換率ボーナス等が乗っていても常に実際の計算と整合する)の2行を追加する。
// hasAdditionalBuffを持つもの(atk/matk/主要ステータス)は「追加バフ」(料理・能力共鳴等、
// calculateRawStats/cookingAdjustmentsでbreakdown.cookingBonusに合流する最終加算)の行を
// 追加する。いずれもstatId自体には依存しない汎用のbreakdown内訳(base/additive/multiplier/
// cookingBonus)を土台にしている。maxHp/atkはBASE_STATS上の初期値が常に0で意味を持たないため
// showBaseValue:falseで「初期値」行・計算式の項から除外する(主要ステータス/耐久力は
// BASE_STATSに実値があるため表示する)。
const BREAKDOWN_STAT_CONFIG: Partial<
  Record<
    StatId,
    {
      conversionSourceStatId?: StatId | 'mainStat';
      conversionValue?: (d: DerivedStats) => number;
      hasAdditionalBuff: boolean;
      showBaseValue?: boolean;
    }
  >
> = {
  maxHp: {
    conversionSourceStatId: 'endurance',
    conversionValue: (d) => d.enduranceMaxHpBonus,
    hasAdditionalBuff: false,
    showBaseValue: false,
  },
  atk: {
    conversionSourceStatId: 'mainStat',
    conversionValue: (d) => d.physicalAtkMainStatBonus,
    hasAdditionalBuff: true,
    showBaseValue: false,
  },
  matk: {
    conversionSourceStatId: 'mainStat',
    conversionValue: (d) => d.magicalAtkMainStatBonus,
    hasAdditionalBuff: true,
    showBaseValue: false,
  },
  strength: { hasAdditionalBuff: true },
  intellect: { hasAdditionalBuff: true },
  agility: { hasAdditionalBuff: true },
  endurance: { hasAdditionalBuff: false },
};

// 乗算値を「+X.XX%」形式のボーナス表記にする(StatsDetailDialogの表記と揃える)。
function formatMultiplierBonus(multiplier: number): string {
  const sign = multiplier >= 1 ? '+' : '-';
  return `${sign}${truncate2Str(Math.abs(multiplier - 1) * 100)}%`;
}

function StatTooltip({
  state,
  rawValue,
  currentPercent,
  professionId,
  professionTypeKey,
  derivedStats,
  breakdown,
  rawStats,
  mainStatId,
  onRequestClose,
}: StatTooltipProps) {
  const { t } = useTranslation();
  const { t: tGame } = useTranslation('game-data');
  const linkTextPopup = useLinkTextPopup();
  const { statId } = state;

  const label = t(`buildPlanner.stats.${statId}`);
  const baseDesc = tGame(`statDescs.${statId}`, { defaultValue: '' });
  // 器用さ(mastery)は汎用説明に加え、選択中クラス/型固有の効果説明(MasteryDes)を続けて表示する。
  const classMasteryDes =
    statId === 'mastery'
      ? (tGame(`classes.${professionId}.masteryDes`, {
          returnObjects: true,
          defaultValue: [],
        }) as string[])
      : [];
  const classDesc = classMasteryDes[professionTypeKey === 'type1' ? 0 : 1] ?? '';
  const desc = [baseDesc, classDesc].filter(Boolean).join('<br><br>');

  const basePercent = isBasePercentStat(statId) ? STAT_BASE_PERCENT[statId] : undefined;
  const seasonConstant = isBasePercentStat(statId) ? STAT_SEASON_CONSTANT[statId] : undefined;

  const breakdownConfig = BREAKDOWN_STAT_CONFIG[statId];
  const breakdownEntry = breakdownConfig ? breakdown[statId] : undefined;
  const conversionSourceStatId =
    breakdownConfig?.conversionSourceStatId === 'mainStat'
      ? mainStatId
      : breakdownConfig?.conversionSourceStatId;
  const conversionValue = breakdownConfig?.conversionValue?.(derivedStats);
  const conversionSourceValue = conversionSourceStatId ? rawStats[conversionSourceStatId] : undefined;
  const conversionSourceLabel = conversionSourceStatId
    ? t(`buildPlanner.stats.${conversionSourceStatId}`)
    : undefined;
  // 変換定数は「変換元の生値 × 変換定数 = conversionValue」となるよう逆算する。能力共鳴等の
  // 変換率ボーナスがconversionValueに乗っていても、この方式なら常に実際の計算と一致する。
  const conversionRate =
    conversionSourceValue !== undefined && conversionValue !== undefined && conversionSourceValue !== 0
      ? conversionValue / conversionSourceValue
      : undefined;
  const additionalBuff =
    breakdownConfig?.hasAdditionalBuff ? (breakdownEntry?.cookingBonus ?? 0) : undefined;
  const showBaseValue = breakdownConfig?.showBaseValue ?? true;

  return (
    <FloatingTooltip
      x={state.x}
      y={state.y}
      clamp
      className="stat-tooltip"
      onRequestClose={onRequestClose}
    >
      <div className="stat-tooltip__header">{label}</div>
      <hr className="stat-tooltip__hr" />
      {desc && (
        <p className="stat-tooltip__desc">{renderMarkup(desc, linkTextPopup.handlers)}</p>
      )}
      <hr className="stat-tooltip__hr" />
      {basePercent !== undefined && seasonConstant !== undefined ? (
        <>
          <div className="stat-tooltip__value-row">
            <span className="stat-tooltip__value-label">
              {t('buildPlanner.statTooltip.currentRate')}
            </span>
            <span className="stat-tooltip__value">{truncate2Str(currentPercent)}%</span>
          </div>
          <hr className="stat-tooltip__hr" />
          <div className="stat-tooltip__value-row">
            <span className="stat-tooltip__value-label">
              {t('buildPlanner.statTooltip.currentValue')}
            </span>
            <span className="stat-tooltip__value">{truncate2Str(rawValue)}</span>
          </div>
          <div className="stat-tooltip__value-row">
            <span className="stat-tooltip__value-label">
              {t('buildPlanner.statTooltip.baseRate')}
            </span>
            <span className="stat-tooltip__value">{truncate2Str(basePercent)}%</span>
          </div>
          <div className="stat-tooltip__value-row">
            <span className="stat-tooltip__value-label">
              {t('buildPlanner.statTooltip.seasonConstant')}
            </span>
            <span className="stat-tooltip__value">{seasonConstant.toLocaleString()}</span>
          </div>
          <p className="stat-tooltip__formula">
            {t('buildPlanner.statTooltip.formula', {
              currentValue: t('buildPlanner.statTooltip.currentValue'),
              seasonConstant: t('buildPlanner.statTooltip.seasonConstant'),
              baseRate: t('buildPlanner.statTooltip.baseRate'),
              currentRate: t('buildPlanner.statTooltip.currentRate'),
            })}
          </p>
        </>
      ) : (
        <div className="stat-tooltip__value-row">
          <span className="stat-tooltip__value-label">
            {t('buildPlanner.statTooltip.currentValue')}
          </span>
          <span className="stat-tooltip__value">{truncate2Str(rawValue)}</span>
        </div>
      )}
      {breakdownConfig && breakdownEntry && (
        <>
          <hr className="stat-tooltip__hr" />
          {showBaseValue && (
            <div className="stat-tooltip__value-row">
              <span className="stat-tooltip__value-label">
                {t('buildPlanner.statTooltip.baseValue')}
              </span>
              <span className="stat-tooltip__value">{truncate2Str(breakdownEntry.base)}</span>
            </div>
          )}
          {conversionSourceLabel && (
            <div className="stat-tooltip__value-row">
              <span className="stat-tooltip__value-label">{conversionSourceLabel}</span>
              <span className="stat-tooltip__value">
                {truncate2Str(conversionSourceValue ?? 0)}
              </span>
            </div>
          )}
          {conversionSourceLabel && (
            <div className="stat-tooltip__value-row">
              <span className="stat-tooltip__value-label">
                {t('buildPlanner.statTooltip.conversionRate')}
              </span>
              <span className="stat-tooltip__value">{truncate2Str(conversionRate ?? 0)}</span>
            </div>
          )}
          <div className="stat-tooltip__value-row">
            <span className="stat-tooltip__value-label">
              {t('buildPlanner.statTooltip.additiveValue')}
            </span>
            <span className="stat-tooltip__value">{truncate2Str(breakdownEntry.additive)}</span>
          </div>
          <div className="stat-tooltip__value-row">
            <span className="stat-tooltip__value-label">
              {t('buildPlanner.statTooltip.multiplierValue')}
            </span>
            <span className="stat-tooltip__value">
              {formatMultiplierBonus(breakdownEntry.multiplier)}
            </span>
          </div>
          {additionalBuff !== undefined && (
            <div className="stat-tooltip__value-row">
              <span className="stat-tooltip__value-label">
                {t('buildPlanner.statTooltip.additionalBuff')}
              </span>
              <span className="stat-tooltip__value">{truncate2Str(additionalBuff)}</span>
            </div>
          )}
          <p className="stat-tooltip__formula">
            {(() => {
              const sumTerms = [
                showBaseValue ? t('buildPlanner.statTooltip.baseValue') : undefined,
                conversionSourceLabel
                  ? `${conversionSourceLabel} * ${t('buildPlanner.statTooltip.conversionRate')}`
                  : undefined,
                t('buildPlanner.statTooltip.additiveValue'),
              ].filter(Boolean);
              let formula = `(${sumTerms.join(' + ')}) * (1 + ${t('buildPlanner.statTooltip.multiplierValue')})`;
              if (additionalBuff !== undefined) {
                formula += ` + ${t('buildPlanner.statTooltip.additionalBuff')}`;
              }
              formula += ` = ${t('buildPlanner.statTooltip.currentValue')}`;
              return formula;
            })()}
          </p>
        </>
      )}
      {linkTextPopup.popup && (
        <LinkTextPopup
          state={linkTextPopup.popup}
          handlers={linkTextPopup.handlers}
          onMouseEnter={linkTextPopup.cancelClose}
          onMouseLeave={linkTextPopup.scheduleClose}
        />
      )}
    </FloatingTooltip>
  );
}

export default StatTooltip;
