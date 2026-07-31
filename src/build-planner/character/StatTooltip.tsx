import { useTranslation } from 'react-i18next';
import FloatingTooltip from '../components/FloatingTooltip';
import LinkTextPopup from '../components/LinkTextPopup';
import { renderMarkup } from '../components/renderMarkup';
import { useLinkTextPopup } from '../components/useLinkTextPopup';
import { STAT_BASE_PERCENT, STAT_SEASON_CONSTANT } from '../stats/seasonConstants';
import type { StatId } from '../types';
import type { ProfessionTypeKey } from '../profession';
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
  onRequestClose: () => void;
}

function isBasePercentStat(id: StatId): id is keyof typeof STAT_BASE_PERCENT {
  return id in STAT_BASE_PERCENT;
}

function StatTooltip({
  state,
  rawValue,
  currentPercent,
  professionId,
  professionTypeKey,
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
      <div className="stat-tooltip__value-row">
        <span className="stat-tooltip__value-label">
          {t('buildPlanner.statTooltip.currentValue')}
        </span>
        <span className="stat-tooltip__value">{truncate2Str(rawValue)}</span>
      </div>
      {basePercent !== undefined && seasonConstant !== undefined && (
        <>
          <div className="stat-tooltip__value-row">
            <span className="stat-tooltip__value-label">
              {t('buildPlanner.statTooltip.currentRate')}
            </span>
            <span className="stat-tooltip__value">{truncate2Str(currentPercent)}%</span>
          </div>
          <div className="stat-tooltip__value-row">
            <span className="stat-tooltip__value-label">
              {t('buildPlanner.statTooltip.baseRate')}
            </span>
            <span className="stat-tooltip__value">{truncate2Str(basePercent)}%</span>
          </div>
          <div className="stat-tooltip__formula-section">
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
          </div>
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
