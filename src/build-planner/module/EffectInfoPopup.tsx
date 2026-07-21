import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import FloatingTooltip from '../components/FloatingTooltip';
import type { ModuleSlots } from '../types';
import { renderEffectDescLines } from './effectDescRender';
import {
  calcEffectTotalLink,
  formatEffectDesc,
  getEffectIcon,
  getEffectLevel,
  modulesData,
} from './moduleData';

interface EffectInfoPopupProps {
  effectId: number;
  moduleSlots: ModuleSlots;
  x: number;
  y: number;
  /** 'right'(既定): カーソルの右側に表示。'left': パネル右側寄りの効果アイコン用に左側へ表示。 */
  align?: 'right' | 'left';
  /** ホバー中(未ピン留め)はマウスカーソルに追従、クリックでピン留めされている間は位置固定。 */
  pinned?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClose: () => void;
}

function EffectInfoPopup({
  effectId,
  moduleSlots,
  x,
  y,
  align = 'right',
  pinned = false,
  onMouseEnter,
  onMouseLeave,
  onClose,
}: EffectInfoPopupProps) {
  const { t } = useTranslation();
  const { t: tg } = useTranslation('game-data');

  const effData = modulesData.effects[String(effectId)];
  const totalLink = calcEffectTotalLink(effectId, moduleSlots);
  const currentLevel = getEffectLevel(effectId, totalLink);
  const name = tg(`moduleEffects.${effectId}`, { defaultValue: String(effectId) });
  const iconSrc = effData ? getEffectIcon(effData.icon) : undefined;

  const tgAttrDesc = (key: string) => tg(`attrDescs.${key}`, { defaultValue: `attrDescs.${key}` });
  const tgAttr = (key: string) => tg(`attributes.${key}`, { defaultValue: key });
  const tStat = (key: string) => t(`buildPlanner.stats.${key}`);

  return createPortal(
    <FloatingTooltip
      x={x}
      y={y}
      clamp
      align={align}
      className={`mod-effect-popup${pinned ? ' mod-effect-popup--pinned' : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={pinned ? undefined : onMouseLeave}
      onRequestClose={pinned ? onClose : undefined}
    >
      <div className="mod-effect-popup__header">
        {iconSrc && <img src={iconSrc} className="mod-effect-popup__icon" alt="" />}
        <span className="mod-effect-popup__name">{name}</span>
      </div>
      <div className="mod-effect-popup__link">
        {t('buildPlanner.module.linkCount')}: {totalLink}
      </div>
      {effData && (
        <div className="mod-effect-popup__levels-wrap">
          <table className="mod-effect-popup__levels">
            <colgroup>
              <col style={{ width: '32px' }} />
              <col style={{ width: '52px' }} />
              <col />
              <col style={{ width: '44px' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="mod-effect-popup__level-badge" />
                <th className="mod-effect-popup__level-link">
                  {t('buildPlanner.module.linkCount')}
                </th>
                <th className="mod-effect-popup__level-desc" />
                <th className="mod-effect-popup__level-score">{t('buildPlanner.abilityScore')}</th>
              </tr>
            </thead>
            <tbody>
              {effData.levels.map((lvData, lv) => {
                if (lv === 0 || !lvData) return null;
                const [fightValue, enhancementNum, config, ev] = lvData;
                const isActive = lv === currentLevel;
                const descParts = formatEffectDesc(config, ev ?? [], tgAttrDesc, tgAttr, tStat);
                return (
                  <tr
                    key={lv}
                    className={`mod-effect-popup__level-row${isActive ? ' mod-effect-popup__level-row--active' : ''}`}
                  >
                    <td className="mod-effect-popup__level-badge">Lv{lv}</td>
                    <td className="mod-effect-popup__level-link">{enhancementNum}</td>
                    <td className="mod-effect-popup__level-desc">
                      {descParts.length > 0 ? renderEffectDescLines(descParts) : '—'}
                    </td>
                    <td className="mod-effect-popup__level-score">{fightValue}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </FloatingTooltip>,
    document.body,
  );
}

export default EffectInfoPopup;
