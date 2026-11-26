import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DraggableDialog from '../components/DraggableDialog';
import Stepper from '../components/Stepper';
import type { Profession } from '../profession';
import type { EquipmentSlotId, SlotRefineLevels } from '../types';
import { ALL_EQUIPMENT_SLOTS, isDefenseRefineSlot, MAX_REFINE_LEVEL } from './equipmentData';

type RefineBulkTarget = 'all' | 'attack' | 'defense';
const BULK_TARGETS: RefineBulkTarget[] = ['all', 'attack', 'defense'];

interface RefineBulkDialogProps {
  refineLevels: SlotRefineLevels;
  profession: Profession;
  onChange: (levels: SlotRefineLevels) => void;
  /** 部位のアイコン(未装備時のプレースホルダー)。 */
  getSlotIcon: (slot: EquipmentSlotId) => string | undefined;
  onClose: () => void;
}

// 精錬Lv一括変更ダイアログ。上部で全部位/攻撃用部位/防御用部位のLvを選んで「反映」すると
// 対象部位へまとめて設定し、下部では部位ごとの精錬Lvを直接変更できる。
// 攻撃用/防御用は精錬効果(精錬防御力が上がるか)で判定する(isDefenseRefineSlot)。
function RefineBulkDialog({
  refineLevels,
  profession,
  onChange,
  getSlotIcon,
  onClose,
}: RefineBulkDialogProps) {
  const { t } = useTranslation();
  // 一括変更の各行で選択中のLv(反映ボタンを押すまで部位には反映しない)。
  const [bulkLevels, setBulkLevels] = useState<Record<RefineBulkTarget, number>>({
    all: MAX_REFINE_LEVEL,
    attack: MAX_REFINE_LEVEL,
    defense: MAX_REFINE_LEVEL,
  });

  const attackSlots = ALL_EQUIPMENT_SLOTS.filter((s) => !isDefenseRefineSlot(s, profession));
  const defenseSlots = ALL_EQUIPMENT_SLOTS.filter((s) => isDefenseRefineSlot(s, profession));
  const slotsOf = (target: RefineBulkTarget) =>
    target === 'all' ? ALL_EQUIPMENT_SLOTS : target === 'attack' ? attackSlots : defenseSlots;

  const applyBulk = (target: RefineBulkTarget) => {
    const next = { ...refineLevels };
    for (const slot of slotsOf(target)) next[slot] = bulkLevels[target];
    onChange(next);
  };

  const renderSlotRow = (slot: EquipmentSlotId) => {
    const icon = getSlotIcon(slot);
    return (
      <div key={slot} className="refine-bulk-dialog__slot-row">
        <span className="refine-bulk-dialog__slot-icon">{icon && <img src={icon} alt="" />}</span>
        <span className="refine-bulk-dialog__slot-name">{t(`buildPlanner.slots.${slot}`)}</span>
        <Stepper
          className="equip-refine-level-control"
          modifierClassName="refine-bulk-dialog__stepper"
          layout="inline"
          value={refineLevels[slot]}
          min={0}
          max={MAX_REFINE_LEVEL}
          onChange={(level) => onChange({ ...refineLevels, [slot]: level })}
        />
      </div>
    );
  };

  return (
    <DraggableDialog
      title={t('buildPlanner.refineBulk.title')}
      onClose={onClose}
      className="refine-bulk-dialog"
    >
      <section className="equip-details-section">
        <h3 className="equip-details-section__heading">
          {t('buildPlanner.refineBulk.bulkHeading')}
        </h3>
        {BULK_TARGETS.map((target) => (
          <div key={target} className="refine-bulk-dialog__bulk-row">
            <span className="refine-bulk-dialog__bulk-label">
              {t(`buildPlanner.refineBulk.${target}`)}
            </span>
            <Stepper
              className="equip-refine-level-control"
              modifierClassName="refine-bulk-dialog__stepper"
              layout="inline"
              value={bulkLevels[target]}
              min={0}
              max={MAX_REFINE_LEVEL}
              onChange={(level) => setBulkLevels((prev) => ({ ...prev, [target]: level }))}
            />
            <button
              type="button"
              className="refine-bulk-dialog__apply"
              onClick={() => applyBulk(target)}
            >
              {t('buildPlanner.refineBulk.apply')}
            </button>
          </div>
        ))}
      </section>

      <div className="refine-bulk-dialog__columns">
        <section className="equip-details-section">
          <h3 className="equip-details-section__heading">{t('buildPlanner.refineBulk.attack')}</h3>
          {attackSlots.map(renderSlotRow)}
        </section>
        <section className="equip-details-section">
          <h3 className="equip-details-section__heading">{t('buildPlanner.refineBulk.defense')}</h3>
          {defenseSlots.map(renderSlotRow)}
        </section>
      </div>
    </DraggableDialog>
  );
}

export default RefineBulkDialog;
