import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './equipment.css';
import {
  EQUIPMENT_BOTTOM_SLOTS,
  EQUIPMENT_TOP_SLOTS,
  getGearType,
  getItemsBySlot,
} from './equipmentData';
import type { Profession, ProfessionTypeKey } from '../profession';
import EquipmentSlotPicker from './EquipmentSlotPicker';
import EquipmentSlotButton from './EquipmentSlotButton';
import EquipmentItemPopup from './EquipmentItemPopup';
import { isSeaBreezeSeries, qualityToAssetIndex } from './equipmentSlotPickerData';
import type {
  EquipmentItem,
  EquipmentSlotId,
  EquippedItems,
  EvolutionStatId,
  LegendaryAffixSelection,
  SlotEnchants,
  SlotEvolutionStats,
  SlotLegendaryAffix,
  SlotRefineLevels,
} from '../types';

// ---- アイコン ----

const _equipMods = import.meta.glob<{ default: string }>(
  [
    '../../assets/equipments/weap_equip_*.png',
    '../../assets/equipments/ch_wp_*.png',
    '../../assets/equipments/c_equip_icon_*.png',
    '../../assets/equipments/headwear_icon_*.png',
    '../../assets/equipments/clothes_icon_*.png',
    '../../assets/equipments/gloves_icon_*.png',
    '../../assets/equipments/shoes_icon_*.png',
    '../../assets/equipments/ears_icon_*.png',
    '../../assets/equipments/neck_icon_*.png',
    '../../assets/equipments/ring_icon_*.png',
  ],
  { eager: true },
);

function getEquipUrl(name: string): string | undefined {
  return (
    _equipMods[`../../assets/equipments/${name}.png`]?.default ??
    _equipMods[`../../assets/equipments/${name.replace(/_m_/, '_f_')}.png`]?.default
  );
}

// 未装備時スロットアイコン
const SLOT_EMPTY_ICON: Partial<Record<EquipmentSlotId, string>> = {
  weapon: 'weap_equip_weapon',
  head: 'weap_equip_head_off',
  chest: 'weap_equip_clothes_off',
  arms: 'weap_equip_hand_off',
  legs: 'weap_equip_shoes_off',
  earring: 'weap_equip_earring_off',
  necklace: 'weap_equip_necklace_off',
  ring: 'weap_equip_ring_off',
  ringLeft: 'weap_equip_bracelet_off_01',
  ringRight: 'weap_equip_bracelet_off_02',
  belt: 'weap_equip_amulet_off',
};

const _uiMods = import.meta.glob<{ default: string }>(
  ['../../assets/ui/weap_equip_*.png', '../../assets/ui/item_quality_equip_*.png'],
  { eager: true },
);

// アイテムのqualityと種類から背景画像名を決定
// 00=Lv10相当(q1), 01=Lv20相当(q2), 03=紫(q3), 04=黄土(q4), 05=赤(q5), 07=蒼海武器
function getEquipBgUrl(slot: EquipmentSlotId, item?: EquipmentItem): string | undefined {
  let name;
  if (BOTTOM_SLOT_SET.has(slot)) {
    name = `item_quality_equip_${item ? qualityToAssetIndex(item.quality) : 0}`;
  } else if (!item) {
    name = 'weap_equip_00';
  } else if (isSeaBreezeSeries(item)) {
    name = 'weap_equip_07';
  } else {
    name = `weap_equip_${String(qualityToAssetIndex(item.quality)).padStart(2, '0')}`;
  }
  return _uiMods[`../../assets/ui/${name}.png`]?.default;
}

const BOTTOM_SLOT_SET = new Set<EquipmentSlotId>(EQUIPMENT_BOTTOM_SLOTS);

// パネル右側寄りの部位はポップアップが画面外/クリック操作の邪魔になるため左側に表示する。
const LEFT_ALIGNED_POPUP_SLOTS = new Set<EquipmentSlotId>([
  'arms',
  'legs',
  'necklace',
  'ring',
  'ringRight',
  'belt',
]);

// 装備中アイコン: 武器は _t、防具・アクセサリは _l サフィックス付きを優先。未装備はスロット別プレースホルダー。
function getSlotIconUrl(
  slot: EquipmentSlotId,
  item: EquipmentItem | undefined,
): string | undefined {
  if (item) {
    const suffix = slot === 'weapon' ? '_t' : '_l';
    return getEquipUrl(item.icon + suffix) ?? getEquipUrl(item.icon);
  }
  const emptyName = SLOT_EMPTY_ICON[slot];
  return emptyName ? getEquipUrl(emptyName) : undefined;
}

// ---- Component ----

interface EquipmentPanelProps {
  equipped: EquippedItems;
  profession: Profession;
  professionTypeKey: ProfessionTypeKey;
  refineLevels: SlotRefineLevels;
  perfectlines: SlotRefineLevels;
  evolutionStats: SlotEvolutionStats;
  legendaryAffixState: SlotLegendaryAffix;
  slotEnchants: SlotEnchants;
  onEquip: (slot: EquipmentSlotId, item: EquipmentItem) => void;
  onUnequip: (slot: EquipmentSlotId) => void;
  onRefineLevel: (slot: EquipmentSlotId, level: number) => void;
  onPerfectline: (slot: EquipmentSlotId, value: number) => void;
  onSetEvolutionStat: (
    slot: EquipmentSlotId,
    slotIndex: number,
    statId: EvolutionStatId | undefined,
  ) => void;
  onSetLegendaryAffix: (
    slot: EquipmentSlotId,
    selection: LegendaryAffixSelection | undefined,
  ) => void;
  onSetEnchant: (slot: EquipmentSlotId, itemId: number | undefined) => void;
}

function EquipmentPanel({
  equipped,
  profession,
  professionTypeKey,
  refineLevels,
  perfectlines,
  evolutionStats,
  legendaryAffixState,
  slotEnchants,
  onEquip,
  onUnequip,
  onRefineLevel,
  onPerfectline,
  onSetEvolutionStat,
  onSetLegendaryAffix,
  onSetEnchant,
}: EquipmentPanelProps) {
  const { t } = useTranslation();
  const [openSlot, setOpenSlot] = useState<EquipmentSlotId | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<{
    slot: EquipmentSlotId;
    x: number;
    y: number;
  } | null>(null);

  const renderSlot = (slot: EquipmentSlotId) => {
    const item = equipped[slot];
    return (
      <EquipmentSlotButton
        key={slot}
        slot={slot}
        item={item}
        refineLevel={refineLevels[slot]}
        iconUrl={getSlotIconUrl(slot, item)}
        bgUrl={getEquipBgUrl(slot, item)}
        isBottom={BOTTOM_SLOT_SET.has(slot)}
        onOpen={() => setOpenSlot(slot)}
        onUnequip={() => onUnequip(slot)}
        onHoverMove={item ? (x, y) => setHoveredSlot({ slot, x, y }) : undefined}
        onHoverEnd={item ? () => setHoveredSlot(null) : undefined}
      />
    );
  };

  const hoveredItem = hoveredSlot ? equipped[hoveredSlot.slot] : undefined;

  return (
    <section className="equipment-panel">
      <div className="equipment-panel__weapon">{renderSlot('weapon')}</div>
      <div className="equipment-panel__grids">
        <div className="equipment-panel__grid equipment-panel__grid--top">
          {EQUIPMENT_TOP_SLOTS.map(renderSlot)}
        </div>
        <div className="equipment-panel__grid equipment-panel__grid--bottom">
          {EQUIPMENT_BOTTOM_SLOTS.map(renderSlot)}
        </div>
      </div>
      {openSlot && (
        <EquipmentSlotPicker
          slot={openSlot}
          slotLabel={t(`buildPlanner.slots.${openSlot}`)}
          candidates={getItemsBySlot(openSlot).filter((item) => {
            if (openSlot === 'weapon') return item.weaponProfessionId === profession.professionId;
            const gearType = getGearType(item);
            return gearType === null || gearType === profession.mainStat;
          })}
          equippedId={equipped[openSlot]?.id}
          equippedItems={equipped}
          refineLevel={refineLevels[openSlot]}
          perfectline={perfectlines[openSlot]}
          profession={profession}
          professionTypeKey={professionTypeKey}
          evolutionStats={evolutionStats[openSlot] ?? []}
          selectedLegendaryAffix={legendaryAffixState[openSlot]}
          selectedEnchant={slotEnchants[openSlot] ?? undefined}
          onSelect={(selected) => onEquip(openSlot, selected)}
          onUnequip={() => onUnequip(openSlot)}
          onRefineLevel={(level) => onRefineLevel(openSlot, level)}
          onPerfectline={(value) => onPerfectline(openSlot, value)}
          onSetEvolutionStat={(idx, statId) => onSetEvolutionStat(openSlot, idx, statId)}
          onSetLegendaryAffix={(sel) => onSetLegendaryAffix(openSlot, sel)}
          onSetEnchant={(itemId) => onSetEnchant(openSlot, itemId)}
          onClose={() => setOpenSlot(null)}
        />
      )}
      {!openSlot && hoveredSlot && hoveredItem && (
        <EquipmentItemPopup
          mouseX={hoveredSlot.x}
          mouseY={hoveredSlot.y}
          align={LEFT_ALIGNED_POPUP_SLOTS.has(hoveredSlot.slot) ? 'left' : 'right'}
          slot={hoveredSlot.slot}
          item={hoveredItem}
          equippedItems={equipped}
          refineLevel={refineLevels[hoveredSlot.slot]}
          perfectline={perfectlines[hoveredSlot.slot]}
          profession={profession}
          professionTypeKey={professionTypeKey}
          evolutionStats={evolutionStats[hoveredSlot.slot] ?? []}
          selectedLegendaryAffix={legendaryAffixState[hoveredSlot.slot]}
          selectedEnchant={slotEnchants[hoveredSlot.slot] ?? undefined}
        />
      )}
    </section>
  );
}

export default EquipmentPanel;
