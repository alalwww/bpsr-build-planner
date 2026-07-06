import { useTranslation } from 'react-i18next';
import type { EquipmentItem, EquipmentSlotId } from '../types';

interface EquipmentSlotButtonProps {
  slot: EquipmentSlotId;
  item: EquipmentItem | undefined;
  refineLevel: number;
  iconUrl: string | undefined;
  bgUrl: string | undefined;
  isBottom: boolean;
  onOpen: () => void;
  onUnequip: () => void;
  /** カーソル追従ポップアップ用。マウス移動のたびに現在座標を通知する。 */
  onHoverMove?: (x: number, y: number) => void;
  onHoverEnd?: () => void;
}

function EquipmentSlotButton({
  slot,
  item,
  refineLevel,
  iconUrl,
  bgUrl,
  isBottom,
  onOpen,
  onUnequip,
  onHoverMove,
  onHoverEnd,
}: EquipmentSlotButtonProps) {
  const { t } = useTranslation();
  return (
    <div className="equipment-slot" key={slot}>
      <button
        type="button"
        className="equipment-slot__button"
        onClick={onOpen}
        onMouseMove={onHoverMove ? (e) => onHoverMove(e.clientX, e.clientY) : undefined}
        onMouseLeave={onHoverEnd}
      >
        {bgUrl && (
          <span
            className={`equipment-slot__bg${isBottom ? ' equipment-slot__bg--bottom' : ''}`}
            style={{ backgroundImage: `url(${bgUrl})` }}
          />
        )}
        {iconUrl && (
          <img
            className={`equipment-slot__icon${item ? ' equipment-slot__icon--gear' + (isBottom ? ' equipment-slot__icon--gear--bottom' : '') : ' equipment-slot__icon--empty'}`}
            src={iconUrl}
            alt=""
          />
        )}
        <div className="equipment-slot__top">
          <span className="equipment-slot__label">{t(`buildPlanner.slots.${slot}`)}</span>
          <span className="equipment-slot__item-level">
            {item ? t('buildPlanner.equipLevel', { level: item.equipGs }) : ''}
          </span>
          {item && (
            <span className="equipment-slot__name">
              {t(`items.${item.id}.name`, { ns: 'game-data' })}
            </span>
          )}
        </div>
        <div className="equipment-slot__refine">
          <span className="equipment-slot__refine-label">{t('buildPlanner.refineLevel')}</span>
          <span className="equipment-slot__refine-value">{refineLevel}</span>
        </div>
      </button>
      {item && (
        <button
          type="button"
          className="equipment-slot__remove"
          aria-label={t('buildPlanner.unequip')}
          title={t('buildPlanner.unequip')}
          onClick={(e) => {
            e.stopPropagation();
            onUnequip();
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

export default EquipmentSlotButton;
