import equipmentJson from '../../data/equipment.json';
import refineJson from '../../data/refine.json';
import type { Profession, ProfessionTypeKey } from '../profession';
import type {
  EquipmentItem,
  EquipmentSlotId,
  EquippedItems,
  EvolutionStatId,
  LegendaryAffixEntry,
} from '../types';
import { hasDistinctEvoAttrs } from '../stats/evoResolution';

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

// ---------- 進化ステータスの表示/適用パターン分類 ----------
// EquipmentSlotPicker(選択ダイアログ)・EquipmentItemPopup(ホバーポップアップ)・
// calculateRawStats(ステータス計算)が同じ分類を共有し、表示と計算の食い違いを防ぐ。

/** クラス型(type1/type2)に対応する TalentSchoolId を返す。 */
export function getTalentSchoolId(
  profession: Profession,
  professionTypeKey: ProfessionTypeKey,
): number {
  return profession.talentSchoolIds[professionTypeKey === 'type1' ? 0 : 1];
}

/** fixedEvolutionStats の1エントリ: [effectType, attrId, min, max, isPercent, fvMin, fvMax] */
export type FixedEvoEffect = [number, number, number, number, boolean, number, number];

// 分類:
//   seriesFixed: 固定ステータス(全baseStatsがmin===max) + 固定Evoあり
//                → シリーズ装備。全 Evo 固定表示・改鋳なし
//   btFixed:     固定ステータスでない + 固定Evoあり
//                → BT突破防具。Evo1/2 固定(完成度依存) + 改鋳選択可
//   dataEvo:     evoデータあり・attrId相異 → Evo1/2 は attrId で確定 + 改鋳選択可
//   sameEvo:     evoデータあり・全attrId同一 → 2スロット選択式 + 改鋳選択可
//   selectable:  evoデータなし → 3スロットすべて選択式(低レベル装備等)
export type EvoDisplayKind = 'seriesFixed' | 'btFixed' | 'dataEvo' | 'sameEvo' | 'selectable';

export interface EvoDisplayInfo {
  kind: EvoDisplayKind;
  /** 全基礎ステータスが min===max の固定ステータス装備(蒼海シリーズ等)か。 */
  isFixedStat: boolean;
  /** クラス型(talentSchoolId)に対応する固定進化ステータス。seriesFixed/btFixed 以外は null。 */
  fixedEvoEffects: FixedEvoEffect[] | null;
}

export function classifyEvoDisplay(item: EquipmentItem, talentSchoolId: number): EvoDisplayInfo {
  const isFixedStat =
    item.baseStats.length > 0 && item.baseStats.every(([, min, max]) => min === max);
  const effects = item.fixedEvolutionStats[String(talentSchoolId)] as FixedEvoEffect[] | undefined;
  const fixedEvoEffects = effects && effects.length > 0 ? effects : null;
  if (fixedEvoEffects) {
    return { kind: isFixedStat ? 'seriesFixed' : 'btFixed', isFixedStat, fixedEvoEffects };
  }
  const kind: EvoDisplayKind =
    item.evo.length === 0 ? 'selectable' : hasDistinctEvoAttrs(item.evo) ? 'dataEvo' : 'sameEvo';
  return { kind, isFixedStat, fixedEvoEffects: null };
}

// evo(attrId相異="dataEvo")以外の全フィールドが一致するアイテムを「同一装備の進化
// ステータス組み合わせ違い」とみなすための比較キー。[極]系装備(evo2要素の組み合わせ違い)・
// [匠]系装備(evo1要素の単一ステータス違い)等、外見・基礎ステータス・伝説刻印・装着効果は
// 完全に同一で evo だけが異なる別アイテムIDが大量に存在するため、それらをグループ化するのに使う。
function evoVariantSignature(item: EquipmentItem): string {
  return JSON.stringify([
    item.part,
    item.equipGs,
    item.quality,
    item.icon,
    item.weaponProfessionId ?? null,
    item.baseStats,
    item.reforgeMaxPerfectline,
    item.reforgeEvoMin,
    item.reforgeEvoMax,
    item.reforgeEvoFvMin,
    item.reforgeEvoFvMax,
    item.fixedEvolutionStats,
    item.btGroupId ?? null,
    item.btTime ?? null,
    item.legendaryAffix ?? null,
    item.legendaryAffixGroups ?? null,
    item.enchantId ?? null,
    item.suitId ?? null,
  ]);
}

// item と同じ evoVariantSignature を持つ候補(自身を含む)を返す。2件未満(=バリアントを
// 持たない単独アイテム)の場合は null。EquipmentSlotPicker の突破(btGroupId)切り替えと
// 同様、進化ステータスの組み合わせ違いをグループとして切り替え可能にするために使う。
// evo の要素数(1件=[匠]系の単一ステータス違い、2件=[極]系の組み合わせ違い)が異なる
// 候補は同一ファミリーとみなさない。
export function getEvoVariantFamily(
  item: EquipmentItem,
  candidates: EquipmentItem[],
): EquipmentItem[] | null {
  if (item.evo.length === 0 || !hasDistinctEvoAttrs(item.evo)) return null;
  const key = evoVariantSignature(item);
  const family = candidates.filter(
    (c) =>
      c.evo.length === item.evo.length &&
      hasDistinctEvoAttrs(c.evo) &&
      evoVariantSignature(c) === key,
  );
  return family.length > 1 ? family : null;
}

/** 蒼海武器等の4枠選択式レアステータス: クラス型(talentSchoolId)に対応する枠別候補群を返す。 */
export function getLegendaryAffixGroups(
  item: EquipmentItem,
  talentSchoolId: number,
): LegendaryAffixEntry[][] | null {
  return item.legendaryAffixGroups?.[String(talentSchoolId)] ?? null;
}
