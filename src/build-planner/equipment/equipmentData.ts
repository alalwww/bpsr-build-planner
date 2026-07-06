import equipmentJson from '../../data/equipment.json';
import refineJson from '../../data/refine.json';
import type { Profession } from '../profession';
import type {
  EquipmentItem,
  EquipmentSlotId,
  EquippedItems,
  EvolutionStatId,
  LegendaryAffixEntry,
} from '../types';

// 右上段(4列1行): 頭部/胴部/腕部/脚部
export const EQUIPMENT_TOP_SLOTS: EquipmentSlotId[] = ['head', 'chest', 'arms', 'legs'];

// 右下段(3列2行): 耳飾り/首飾り/指輪 ・ 腕輪-左/腕輪-右/護符
export const EQUIPMENT_BOTTOM_SLOTS: EquipmentSlotId[] = [
  'earring',
  'necklace',
  'ring',
  'ringLeft',
  'ringRight',
  'belt',
];

export const DEFAULT_LOADOUT: EquippedItems = {};

export interface RefineTypeData {
  /** 0始まりのインデックスで Level = index+1。各エントリは [[attrId, value], ...] */
  cumulative: [number, number][][];
  /** キーは精錬レベル文字列 ("5"/"10"/...)、値は [[attrId, value], ...] */
  milestones: Record<string, [number, number][]>;
}

interface RefineJsonData {
  partRefineIds: Record<string, Record<string, number>>;
  refineById: Record<string, RefineTypeData>;
}

const rawRefineData = refineJson as unknown as RefineJsonData;

export const SLOT_TO_PART_ID: Record<EquipmentSlotId, number> = {
  weapon: 200,
  head: 201,
  chest: 202,
  arms: 203,
  legs: 204,
  earring: 205,
  necklace: 206,
  ring: 207,
  ringLeft: 208,
  ringRight: 209,
  belt: 210,
};

interface RawEntry {
  id: number;
  part: number;
  equipGs: number;
  quality: number;
  icon: string;
  weaponProfessionId?: number;
  baseStats: [number, number, number][];
  evo: [number, number, number][];
  reforgeMaxPerfectline: number;
  reforgeEvoMin: number;
  reforgeEvoMax: number;
  reforgeEvoFvMin: number;
  reforgeEvoFvMax: number;
  fixedEvolutionStats: Record<string, [number, number, number, number, boolean, number, number][]>;
  btGroupId?: number;
  btTime?: number;
  legendaryAffix?: LegendaryAffixEntry[];
  enchantId?: number;
  suitId?: number;
}

const rawData = equipmentJson as unknown as Record<string, Record<string, RawEntry>>;

// ---------- 進化ステータス制限テーブル (maxroll.gg Blue Protocol Gear Guide より) ----------
// 装備の基礎属性タイプ(筋力/知力/俊敏)と装備スロットで、選択不可のEvoステータスが決まる。
// 武器はデータなし（制限なし）。レイドギアはゲーム内で制限をバイパスするが、
// レイドギアはシリーズ装備(isSeriesFixed)として Evo 固定表示になるため影響なし。

const STRENGTH_ATTR_ID = 11012;
const INTELLECT_ATTR_ID = 11022;
const AGILITY_ATTR_ID = 11032;

type GearType = 'strength' | 'intellect' | 'agility';

// slot → gearType → 選択不可 EvolutionStatId
const EVO_RESTRICTIONS: Partial<Record<EquipmentSlotId, Record<GearType, EvolutionStatId>>> = {
  head: { strength: 'versatility', intellect: 'crit', agility: 'haste' },
  chest: { strength: 'haste', intellect: 'luck', agility: 'crit' },
  arms: { strength: 'haste', intellect: 'versatility', agility: 'crit' },
  legs: { strength: 'mastery', intellect: 'luck', agility: 'crit' },
  earring: { strength: 'mastery', intellect: 'versatility', agility: 'haste' },
  necklace: { strength: 'haste', intellect: 'luck', agility: 'mastery' },
  ring: { strength: 'luck', intellect: 'mastery', agility: 'versatility' },
  ringLeft: { strength: 'crit', intellect: 'haste', agility: 'versatility' },
  ringRight: { strength: 'crit', intellect: 'mastery', agility: 'luck' },
  belt: { strength: 'versatility', intellect: 'haste', agility: 'luck' },
};

export function getGearType(item: EquipmentItem): GearType | null {
  for (const [attrId] of item.baseStats) {
    if (attrId === STRENGTH_ATTR_ID) return 'strength';
    if (attrId === INTELLECT_ATTR_ID) return 'intellect';
    if (attrId === AGILITY_ATTR_ID) return 'agility';
  }
  return null;
}

/** 装備スロットと装備の基礎属性タイプから選択不可の Evo ステータスを返す。制限なしの場合は null。 */
export function getRestrictedEvoStat(
  item: EquipmentItem,
  slot: EquipmentSlotId,
): EvolutionStatId | null {
  const gearType = getGearType(item);
  if (!gearType) return null;
  return EVO_RESTRICTIONS[slot]?.[gearType] ?? null;
}

// quality 4以上 ([極]/シリーズ武器) → 完成度上限100、それ未満 → 上限80。
// 固定ステータス装備 (min===max の全stat) はこの値に関わらず完成度スライダーが無効化される。
export function getMaxPerfectline(item: EquipmentItem): number {
  return item.quality >= 4 ? 100 : 80;
}

export function getRefineForSlot(
  slot: EquipmentSlotId,
  profession: Profession,
): RefineTypeData | null {
  const partId = SLOT_TO_PART_ID[slot];
  const partMap = rawRefineData.partRefineIds[String(partId)];
  if (!partMap) return null;
  const refineId = partMap[String(profession.professionId)];
  if (refineId === undefined) return null;
  return rawRefineData.refineById[String(refineId)] ?? null;
}

export function getItemsBySlot(slot: EquipmentSlotId): EquipmentItem[] {
  const partId = SLOT_TO_PART_ID[slot];
  const partData = rawData[String(partId)] ?? {};
  return Object.values(partData)
    .map((entry) => ({ ...entry, slot }))
    .sort((a, b) => b.equipGs - a.equipGs);
}
