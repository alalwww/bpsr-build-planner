import { useTranslation } from 'react-i18next';
import type { ModuleConfig } from '../types';
import {
  getEffectIcon,
  getEmptySlotIcon,
  getModById,
  getModHoles,
  getModIcon,
  getQualityBg,
  modulesData,
} from './moduleData';
import type { CursorTooltipHandlers } from '../components/useCursorTooltip';

interface ModuleSlotProps {
  n: number;
  config: ModuleConfig | null;
  onClick: () => void;
  onRemove: () => void;
  getEffectHandlers: (effectId: number) => CursorTooltipHandlers;
}

function ModuleSlot({ n, config, onClick, onRemove, getEffectHandlers }: ModuleSlotProps) {
  const { t } = useTranslation();
  const { t: tg } = useTranslation('game-data');
  const emptyIcon = getEmptySlotIcon(n);

  if (!config) {
    return (
      <button
        type="button"
        className="module-slot module-slot--empty"
        aria-label={t('buildPlanner.module.slot', { n })}
        onClick={onClick}
      >
        {emptyIcon ? (
          <img src={emptyIcon} className="module-slot__empty-icon" alt="" />
        ) : (
          <span className="module-slot__number">{n}</span>
        )}
      </button>
    );
  }

  const mod = getModById(config.modId);
  const quality = (mod?.quality ?? 3) as 1 | 2 | 3 | 4;
  const modIcon = mod ? getModIcon(mod.modType, quality) : undefined;
  const qualityBg = getQualityBg(quality);
  const numSlots = getModHoles(quality);
  const configuredHoles = config.holes.filter((h) => h.effectId != null);
  const emptySlotCount = numSlots - configuredHoles.length;

  return (
    <div
      className="module-slot module-slot--configured"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
    >
      <div
        className="module-slot__icon-section"
        style={
          qualityBg
            ? {
                backgroundImage: `url(${qualityBg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : {}
        }
      >
        {modIcon && <img src={modIcon} className="module-slot__mod-icon" alt="" />}
        <span className="module-slot__slot-num">{n}</span>
        <button
          type="button"
          className="module-slot__remove-btn"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title={t('buildPlanner.module.removeModule')}
        >
          ✕
        </button>
      </div>
      <div className="module-slot__effects-section">
        {configuredHoles.map((hole, i) => {
          const effData =
            hole.effectId != null ? modulesData.effects[String(hole.effectId)] : undefined;
          const iconSrc = effData ? getEffectIcon(effData.icon) : undefined;
          const name = tg(`moduleEffects.${hole.effectId}`, {
            defaultValue: String(hole.effectId),
          });
          return (
            <div key={i} className="module-slot__effect-row">
              <span
                className="module-slot__effect-icon-wrap"
                {...(hole.effectId != null ? getEffectHandlers(hole.effectId) : {})}
                role="button"
                tabIndex={0}
              >
                {iconSrc && <img src={iconSrc} className="module-slot__effect-icon" alt="" />}
              </span>
              <span className="module-slot__effect-name" title={name}>
                {name}
              </span>
              <span className="module-slot__link-count">+{hole.linkCount}</span>
            </div>
          );
        })}
        {Array.from({ length: Math.max(0, emptySlotCount) }, (_, i) => (
          <span key={`empty-${i}`} className="module-slot__no-effects">
            {t('buildPlanner.module.noEffects')}
          </span>
        ))}
      </div>
    </div>
  );
}

export default ModuleSlot;
