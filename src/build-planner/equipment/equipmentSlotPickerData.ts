import enchantsDataRaw from '../../data/enchants.json';
import suitsDataRaw from '../../data/suits.json';
import { createAssetMap } from '../assetMap';
import type {
  EquipmentItem,
  EquipmentSlotId,
  EquippedItems,
  EvolutionStatId,
  StatId,
} from '../types';
import type { Profession } from '../profession';

// ---- セット効果データ型 ----
export type SuitTier = { limitNum: number; fightValue: number; effects: Record<string, number> };
export const suitsData = suitsDataRaw as Record<string, { tiers: SuitTier[] }>;

// ---- セット効果集計 ----
export interface SuitInfo {
  suitId: number;
  /** 装備中アイテムのうち同一 suitId のピース数。 */
  count: number;
  tiers: SuitTier[];
  /** tier.effects のキーとして使う TalentSchoolId 文字列。 */
  schoolId: string;
}

// item と同じ suitId を持つ装備中ピース数を数え、セット効果表示用の情報を返す。
// セットなし・セットデータなしの場合は null。
export function getSuitInfo(
  item: EquipmentItem | undefined,
  equippedItems: EquippedItems,
  talentSchoolId: number,
): SuitInfo | null {
  const suitId = item?.suitId;
  if (!suitId || !suitsData[String(suitId)]) return null;
  let count = 0;
  for (const eq of Object.values(equippedItems)) {
    if (eq?.suitId === suitId) count++;
  }
  return {
    suitId,
    count,
    tiers: suitsData[String(suitId)].tiers,
    schoolId: String(talentSchoolId),
  };
}

// ---- 装着効果データ型 ----
// enchants.json の単一の定義元。能力スコア/ステータス計算側(stats/gameData.ts)の
// ルックアップテーブルもこのデータから構築する(同じJSONを別の型で二重パースしない)。
export interface EnchantVariant {
  id: number;
  cost?: [number, number][];
  effects: [number, number][];
  fightValue?: number;
}

export interface EnchantItem {
  id: number;
  quality: number;
  icon?: string;
  level?: number;
  cost?: [number, number][];
  // 上級装着コスト: 精/極を狙う場合に必要なコスト。base/refined/perfectで共通(同一トリオ内は
  // ゲームデータ上完全に一致するため、baseの値のみ保持する)。
  advancedCost?: [number, number][];
  effects: [number, number][];
  fightValue?: number;
  refined?: EnchantVariant;
  perfect?: EnchantVariant;
}

export const enchantsData = enchantsDataRaw as unknown as Record<string, EnchantItem[]>;

// ---- 装着効果(エンチャント)の段階解決 ----
export type EnchantGrade = 'base' | 'refined' | 'perfect';

export interface EnchantSelection {
  /** 選択IDが基本/精/極いずれであっても、その基本(ベース)エンチャント。未選択時は undefined。 */
  base: EnchantItem | undefined;
  grade: EnchantGrade;
  /** 選択中の段階に対応する effects/cost を持つデータ。 */
  data: EnchantItem | EnchantVariant | undefined;
}

// selectedEnchantId は基本/精/極いずれかのアイテムID。base を逆引きし、
// 選択中の段階(grade)と対応データを解決する。
export function resolveEnchantSelection(
  enchantsList: EnchantItem[],
  selectedEnchantId: number | undefined,
): EnchantSelection {
  const base =
    selectedEnchantId !== undefined
      ? enchantsList.find(
          (e) =>
            e.id === selectedEnchantId ||
            e.refined?.id === selectedEnchantId ||
            e.perfect?.id === selectedEnchantId,
        )
      : undefined;
  const grade: EnchantGrade =
    base?.refined?.id === selectedEnchantId
      ? 'refined'
      : base?.perfect?.id === selectedEnchantId
        ? 'perfect'
        : 'base';
  const data = grade === 'refined' ? base?.refined : grade === 'perfect' ? base?.perfect : base;
  return { base, grade, data };
}

export interface EnchantGradeView {
  /** 要求したグレードのバリアントが存在しない場合は 'base' にフォールバックした結果を返す。 */
  grade: EnchantGrade;
  id: number;
  effects: [number, number][];
}

// enchant(基本アイテム)を指定したグレードで解決した表示用ビューを返す。候補一覧のホバー/
// 選択時に「希望グレード」を適用するために使う(resolveEnchantSelectionはID→グレードの
// 逆引き、こちらはグレード→IDの正引き)。
export function resolveEnchantGradeView(
  enchant: EnchantItem,
  grade: EnchantGrade,
): EnchantGradeView {
  if (grade === 'refined' && enchant.refined) {
    return { grade: 'refined', id: enchant.refined.id, effects: enchant.refined.effects };
  }
  if (grade === 'perfect' && enchant.perfect) {
    return { grade: 'perfect', id: enchant.perfect.id, effects: enchant.perfect.effects };
  }
  return { grade: 'base', id: enchant.id, effects: enchant.effects };
}

// EnchantId 3001-3004(Gs220+/Lv190+)の候補には、S3新規追加アイテム(id>=3000000, 302xxxx)と
// 旧シーズンから引き継がれたS2アイテム(id<3000000, 1024xxx)が混在する。アイテムIDの帯がそのまま
// シーズンの境界と一致するため、この閾値で判定する(全EnchantIdセットで確認済み: S2以前は max
// 1024771、S3新規は min 3020001)。
const ENCHANT_SEASON3_MIN_ITEM_ID = 3000000;

export function isSeason3EnchantItem(item: EnchantItem): boolean {
  return item.id >= ENCHANT_SEASON3_MIN_ITEM_ID;
}

// ---- 装備アイコン読み込み (プレビューボックス用) ----
const pickerEquipIcon = createAssetMap(
  import.meta.glob<{ default: string }>(
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
  ),
);

export function getPickerEquipUrl(name: string): string | undefined {
  return pickerEquipIcon(name) ?? pickerEquipIcon(name.replace(/_m_/, '_f_'));
}

// ---- 装着効果アイコン読み込み ----
const enchantIcon = createAssetMap(
  import.meta.glob<{ default: string }>('../../assets/enchants/*.png', { eager: true }),
);

export function getEnchantIconUrl(iconName: string): string | undefined {
  if (!iconName) return undefined;
  return enchantIcon(iconName);
}

const itemBg = createAssetMap(
  import.meta.glob<{ default: string }>('../../assets/ui/item_quality_*.png', { eager: true }),
);

// 蒼海シリーズ(WeaponSkinId末尾06)判定。背景画像・名前色の特例分岐で共通利用。
export function isSeaBreezeSeries(item: EquipmentItem): boolean {
  return item.icon.includes('_06_');
}

// quality(1-5)→アセット名末尾の数値。index=2に相当する画像は存在しないため、
// quality<=2は quality-1、quality>=3は quality そのものを使う(0,1,3,4,5)。
// 範囲外のqualityは0にフォールバックする。
// item_quality_N / item_quality_equip_N / weap_equip_0N の3系統アセットで共通の対応関係。
export function qualityToAssetIndex(quality: number): number {
  if (quality < 1 || quality > 5) return 0;
  return quality <= 2 ? quality - 1 : quality;
}

// 装備 quality / icon から背景画像名を決定
export function getEquipBgUrlFrom(item?: EquipmentItem): string | undefined {
  if (!item) return undefined;
  const name = isSeaBreezeSeries(item)
    ? 'item_quality_7'
    : `item_quality_${qualityToAssetIndex(item.quality)}`;
  return itemBg(name);
}

// quality(レアリティ)に応じた表示色。装備アイテム・装着効果(刻印)双方で共通利用。
export function getQualityColor(quality: number): string {
  if (quality === 5) return '#cc4444';
  if (quality === 4) return '#a08040';
  if (quality === 3) return '#9060a8';
  return '#c8c4bc';
}

export function getItemNameColor(item: EquipmentItem): string {
  if (isSeaBreezeSeries(item)) return '#5599dd'; // 蒼海シリーズ（WeaponSkinId末尾06）
  return getQualityColor(item.quality);
}

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

// stats/statValue.ts と同一実装が重複していたため、そちらを単一の定義元として再エクスポートする。
export { calcStatValue } from '../stats/statValue';

// ---- 装備選択候補の絞り込み(GS帯フィルター) ----
// 除外ではなく「優先表示」のためのフィルター: isCandidateGsMatch が真の候補を先頭側に
// ソートするだけで、非該当の候補も一覧には残す(現在の選択値との紐付けを維持するため)。
// 「S3装備」(GS>190)はGS降順ソートと結果が完全に一致する(GS>190の候補は元々先頭に
// 来るため)ため、実質的な意味を持たず削除済み。「全て」ボタンも、選択中のボタンを
// 再クリックすると解除(未選択=絞り込みなし)できるため削除済み(null で表現する)。
export type CandidateGsFilter = 'lv220' | 'lv240' | 'lv260';

export const CANDIDATE_GS_FILTERS: CandidateGsFilter[] = ['lv220', 'lv240', 'lv260'];

export function isCandidateGsMatch(item: EquipmentItem, filter: CandidateGsFilter): boolean {
  switch (filter) {
    case 'lv220':
      return item.equipGs >= 220 && item.equipGs < 240;
    case 'lv240':
      return item.equipGs >= 240 && item.equipGs < 260;
    case 'lv260':
      return item.equipGs >= 260;
  }
}
