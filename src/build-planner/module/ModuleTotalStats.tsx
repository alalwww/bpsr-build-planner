import { Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModuleSlots } from '../types';
import type { Profession } from '../profession';
import {
  calcModuleSpecialEffects,
  calcModuleTotalStats,
  formatEffectDesc,
  getEffectIcon,
  MOD_PCT_STAT_IDS,
  STAT_ORDER,
} from './moduleData';
import { calculateModuleAbilityScore } from '../stats/calculateAbilityScore';
import LinkBonusSection from './LinkBonusSection';
import EquippedEffectsSection from './EquippedEffectsSection';
import type { CursorTooltipHandlers } from '../components/useCursorTooltip';

interface ModuleTotalStatsProps {
  moduleSlots: ModuleSlots;
  profession: Profession;
  getEffectHandlers: (effectId: number) => CursorTooltipHandlers;
}

// パワーコア効果詳細(右パネル下部のステータス内訳)
function ModuleTotalStats({ moduleSlots, profession, getEffectHandlers }: ModuleTotalStatsProps) {
  const { t } = useTranslation();
  const { t: tg } = useTranslation('game-data');
  const { stats, atkSpeedFinalPctAddend, castSpeedFinalPctAddend } = useMemo(
    () => calcModuleTotalStats(moduleSlots, profession),
    [moduleSlots, profession],
  );
  const specialEffects = useMemo(() => calcModuleSpecialEffects(moduleSlots), [moduleSlots]);
  const moduleScore = useMemo(() => calculateModuleAbilityScore(moduleSlots), [moduleSlots]);
  const hasAny =
    STAT_ORDER.some((sid) => stats[sid]) || atkSpeedFinalPctAddend !== 0 || castSpeedFinalPctAddend !== 0;

  const tgAttrDesc = (key: string) => tg(`attrDescs.${key}`, { defaultValue: `attrDescs.${key}` });
  const tgAttr = (key: string) => tg(`attributes.${key}`, { defaultValue: key });
  const tStat = (key: string) => t(`buildPlanner.stats.${key}`);

  return (
    <div className="module-total-stats">
      <LinkBonusSection moduleSlots={moduleSlots} />
      <EquippedEffectsSection moduleSlots={moduleSlots} getEffectHandlers={getEffectHandlers} />

      <div className="module-total-stats__title">{t('buildPlanner.module.totalEffectsStats')}</div>
      {!hasAny ? (
        <div className="module-total-stats__empty">
          {t('buildPlanner.module.noEffectsEquipped')}
        </div>
      ) : (
        <div className="module-total-stats__list">
          {STAT_ORDER.map((statId) => {
            const val = stats[statId];
            if (!val) return null;
            const valueText = MOD_PCT_STAT_IDS.has(statId) ? `${(val / 100).toFixed(2)}%` : val;
            return (
              <div key={statId} className="module-total-stats__row">
                <span className="module-total-stats__stat-name">
                  {t(`buildPlanner.stats.${statId}`)}
                </span>
                <span className="module-total-stats__stat-value">+{valueText}</span>
              </div>
            );
          })}
          {/* 攻撃速度/詠唱速度の%finalバリアントはStatId(rawStats)を持たないためstatsに
              含まれず、ここだけ別枠(atkSpeedFinalPctAddend/castSpeedFinalPctAddend)で描画する。 */}
          {atkSpeedFinalPctAddend !== 0 && (
            <div className="module-total-stats__row">
              <span className="module-total-stats__stat-name">{tgAttr('11722')}</span>
              <span className="module-total-stats__stat-value">
                +{atkSpeedFinalPctAddend.toFixed(2)}%
              </span>
            </div>
          )}
          {castSpeedFinalPctAddend !== 0 && (
            <div className="module-total-stats__row">
              <span className="module-total-stats__stat-name">{tgAttr('11732')}</span>
              <span className="module-total-stats__stat-value">
                +{castSpeedFinalPctAddend.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      )}

      {specialEffects.length > 0 && (
        <div className="module-total-stats__special">
          {specialEffects.map((eff) => {
            const descParts = formatEffectDesc(eff.config, eff.ev, tgAttrDesc, tgAttr, tStat);
            if (descParts.length === 0) return null;
            const iconSrc = eff.icon ? getEffectIcon(eff.icon) : undefined;
            return (
              <div key={eff.key} className="module-total-stats__special-row">
                {iconSrc && (
                  <img className="module-total-stats__special-icon" src={iconSrc} alt="" />
                )}
                <span className="module-total-stats__special-desc">
                  {descParts.map((line, i) => (
                    <Fragment key={i}>
                      {i > 0 && <br />}
                      {line}
                    </Fragment>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="module-total-stats__score">
        <span className="module-total-stats__title">{t('buildPlanner.abilityScore')}</span>
        <div className="module-total-stats__row">
          <span className="module-total-stats__stat-name">
            {t('buildPlanner.abilityScoreBreakdown.moduleLink')}
          </span>
          <span className="module-total-stats__stat-value">
            {moduleScore.link.toLocaleString()}
          </span>
        </div>
        <div className="module-total-stats__row">
          <span className="module-total-stats__stat-name">
            {t('buildPlanner.abilityScoreBreakdown.moduleCore')}
          </span>
          <span className="module-total-stats__stat-value">
            {moduleScore.core.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

export default ModuleTotalStats;
