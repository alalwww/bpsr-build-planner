import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModuleSlots } from '../types';
import { collectEquippedEffects, getEffectIcon, getEffectLevel, modulesData } from './moduleData';
import type { CursorTooltipHandlers } from '../components/useCursorTooltip';

interface EquippedEffectsSectionProps {
  moduleSlots: ModuleSlots;
  getEffectHandlers: (effectId: number) => CursorTooltipHandlers;
}

// パワーコア効果(右パネル中段)
function EquippedEffectsSection({ moduleSlots, getEffectHandlers }: EquippedEffectsSectionProps) {
  const { t } = useTranslation();
  const { t: tg } = useTranslation('game-data');

  const effectLinks = useMemo(() => collectEquippedEffects(moduleSlots), [moduleSlots]);

  if (effectLinks.size === 0) return null;

  return (
    <div className="module-link-section">
      <div className="module-link-section__title">{t('buildPlanner.module.powerCoreEffects')}</div>
      {[...effectLinks.entries()]
        .sort(([aId, aLink], [bId, bLink]) => {
          const aLv = getEffectLevel(aId, aLink);
          const bLv = getEffectLevel(bId, bLink);
          if (bLv !== aLv) return bLv - aLv;
          if (bLink !== aLink) return bLink - aLink;
          return aId - bId;
        })
        .map(([effectId, totalLink]) => {
          const effData = modulesData.effects[String(effectId)];
          const iconSrc = effData ? getEffectIcon(effData.icon) : undefined;
          const name = tg(`moduleEffects.${effectId}`, { defaultValue: String(effectId) });
          const level = getEffectLevel(effectId, totalLink);
          return (
            <div
              key={effectId}
              className="module-link-section__row"
              {...getEffectHandlers(effectId)}
            >
              {iconSrc ? (
                <img src={iconSrc} className="module-link-section__icon" alt="" />
              ) : (
                <div className="module-link-section__icon-placeholder" />
              )}
              <span className="module-link-section__stat-name" title={name}>
                {name}
              </span>
              <span className="module-link-section__stat-value">+{totalLink}</span>
              {level > 0 && <span className="module-link-section__lv">Lv{level}</span>}
            </div>
          );
        })}
    </div>
  );
}

export default EquippedEffectsSection;
