import enchantsDataRaw from '../../data/enchants.json';
import suitsDataRaw from '../../data/suits.json';
import type { EquipmentItem, EquipmentSlotId, EvolutionStatId, StatId } from '../types';
import type { Profession } from '../profession';

// ---- セット効果データ型 ----
export type SuitTier = { limitNum: number; fightValue: number; effects: Record<string, number> };
export const suitsData = suitsDataRaw as Record<string, { tiers: SuitTier[] }>;

// ---- 装着効果データ型 ----
export interface EnchantVariant {
  id: number;
  cost?: [number, number][];
  effects: [number, number][];
}

export interface EnchantItem {
  id: number;
  quality: number;
  icon?: string;
  level?: number;
  cost?: [number, number][];
  effects: [number, number][];
  refined?: EnchantVariant;
  perfect?: EnchantVariant;
}

export const enchantsData = enchantsDataRaw as unknown as Record<string, EnchantItem[]>;

// ---- 装備アイコン読み込み (プレビューボックス用) ----
const _pickerEquipMods = import.meta.glob<{ default: string }>(
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

export function getPickerEquipUrl(name: string): string | undefined {
  return (
    _pickerEquipMods[`../../assets/equipments/${name}.png`]?.default ??
    _pickerEquipMods[`../../assets/equipments/${name.replace(/_m_/, '_f_')}.png`]?.default
  );
}

// ---- 装着効果アイコン読み込み ----
const _enchantMods = import.meta.glob<{ default: string }>('../../assets/enchants/*.png', {
  eager: true,
});

export function getEnchantIconUrl(iconName: string): string | undefined {
  if (!iconName) return undefined;
  return _enchantMods[`../../assets/enchants/${iconName}.png`]?.default;
}

const _itemBgMods = import.meta.glob<{ default: string }>('../../assets/ui/item_quality_*.png', {
  eager: true,
});

// 装備 quality / icon から背景画像名を決定
export function getEquipBgUrlFrom(item?: EquipmentItem): string | undefined {
  let name;
  if (!item) name = '';
  else if (item.icon.includes('_06_')) name = 'item_quality_7';
  else
    switch (item.quality) {
      case 1:
        name = 'item_quality_0';
        break;
      case 2:
        name = 'item_quality_1';
        break;
      case 3:
        name = 'item_quality_3';
        break;
      case 4:
        name = 'item_quality_4';
        break;
      case 5:
        name = 'item_quality_5';
        break;
      default:
        name = 'item_quality_0';
    }
  return _itemBgMods[`../../assets/ui/${name}.png`]?.default;
}

// quality(レアリティ)に応じた表示色。装備アイテム・装着効果(刻印)双方で共通利用。
export function getQualityColor(quality: number): string {
  if (quality === 5) return '#cc4444';
  if (quality === 4) return '#a08040';
  if (quality === 3) return '#9060a8';
  return '#c8c4bc';
}

export function getItemNameColor(item: EquipmentItem): string {
  if (item.icon.includes('_06_')) return '#5599dd'; // 蒼海シリーズ（WeaponSkinId末尾06）
  return getQualityColor(item.quality);
}

export const REFINE_LEVEL_OPTIONS = Array.from({ length: 31 }, (_, i) => i);
export const REFINE_LEVEL_MILESTONES = [5, 10, 15, 20, 25, 30] as const;
export const EVOLUTION_STAT_IDS: EvolutionStatId[] = [
  'haste',
  'crit',
  'luck',
  'versatility',
  'mastery',
];

const ARMOR_SLOTS = new Set<EquipmentSlotId>([
  'head',
  'chest',
  'arms',
  'legs',
  'ringLeft',
  'ringRight',
]);

export function getPlaceholderStatIds(slot: EquipmentSlotId, profession: Profession): StatId[] {
  const atkStat: StatId = profession.attackType === 'physical' ? 'atk' : 'matk';
  if (slot === 'weapon') return ['illusionPower', atkStat, profession.mainStat, 'endurance'];
  if (ARMOR_SLOTS.has(slot))
    return ['illusionPower', 'physicalDef', profession.mainStat, 'endurance'];
  return ['illusionPower', profession.mainStat, 'endurance'];
}

export function calcStatValue(min: number, max: number, perfectline: number): number {
  return Math.floor(min + (max - min) * (perfectline / 100));
}
