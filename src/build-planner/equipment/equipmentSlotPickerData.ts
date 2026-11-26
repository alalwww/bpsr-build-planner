import enchantMaterialIconsRaw from '../../data/enchant-material-icons.json';
import enchantsDataRaw from '../../data/enchants.json';
import suitsDataRaw from '../../data/suits.json';
import { createAssetMap } from '../assetMap';
import { getGsScheduleTier } from '../seasonSchedule';
import type {
  EquipmentItem,
  EquipmentSlotId,
  EquippedItems,
  EvolutionStatId,
  StatId,
} from '../types';
import type { Profession } from '../profession';

// ---- セット効果データ型 ----
export type SuitTierEffect = { buffId: number; params: number[] };
export type SuitTier = {
  limitNum: number;
  fightValue: number;
  effects: Record<string, SuitTierEffect>;
};
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
  // 刻印が追加されたシーズン(刻印セットの系列 = EnchantId の千の位。2=S2, 3=S3, 4=S4)。
  // 新しいシーズンのセットには前シーズンの刻印も含まれるため、その刻印を含む最も古い系列にしている
  // (extract-ztable.mjs)。宝石(EnchantId 1001〜1003)には無い。
  series?: number;
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
  // base===undefined(未選択)の場合、`base?.refined?.id === selectedEnchantId` は
  // undefined === undefined で誤って true になってしまうため、base自体の有無を先に見る。
  const grade: EnchantGrade =
    base !== undefined && base.refined?.id === selectedEnchantId
      ? 'refined'
      : base !== undefined && base.perfect?.id === selectedEnchantId
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

// 刻印候補の並び順: シーズン降順(S4→S3→S2) → レア度降順 → レベル降順 → ID降順。
// 各装備で選べる刻印は装備の EnchantId のセット(ゲームデータの EnchantItemList)で決まる
// (例: S4装備のセット 4001〜4004 はS4/S3の刻印のみで、S2の刻印を含まない)。
export function compareEnchantItems(a: EnchantItem, b: EnchantItem): number {
  return (
    (b.series ?? 0) - (a.series ?? 0) ||
    b.quality - a.quality ||
    (b.level ?? 0) - (a.level ?? 0) ||
    b.id - a.id
  );
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

// ---- 装着コスト素材(幻蝕の玉髄等)のアイコン読み込み ----
const enchantMaterialIcons = enchantMaterialIconsRaw as unknown as Record<string, string>;

export function getEnchantMaterialIconUrl(itemId: number): string | undefined {
  const iconName = enchantMaterialIcons[String(itemId)];
  return iconName ? enchantIcon(iconName) : undefined;
}

const itemBg = createAssetMap(
  import.meta.glob<{ default: string }>('../../assets/ui/item_quality_*.png', { eager: true }),
);

// 蒼海シリーズ(WeaponSkinId 06)・暁光シリーズ(同 14、S4)判定。どちらも蒼海と同じ扱いで、
// 背景画像・名前色の特例分岐で共通利用。
const SEA_BREEZE_LIKE_ICON = /_(?:06|14)_/;
export function isSeaBreezeSeries(item: EquipmentItem): boolean {
  return SEA_BREEZE_LIKE_ICON.test(item.icon);
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

// 蒼海・暁光シリーズの名前色。映痕の品質「上級」(ゲームデータに色が無い)の色にも流用している(phantomAffixData.ts)。
export const SEA_BREEZE_NAME_COLOR = '#5599dd';

export function getItemNameColor(item: EquipmentItem): string {
  if (isSeaBreezeSeries(item)) return SEA_BREEZE_NAME_COLOR; // 蒼海・暁光シリーズ
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
export { calcStatValue, truncate1Str } from '../stats/statValue';

// ---- 装備選択候補の絞り込み ----
// 候補一覧(ドロップダウン)には、絞り込みに一致する候補と現在の選択値のみを表示する
// (filterCandidates)。GS帯と種別(伝説/極/匠)は別々のトグルグループで、それぞれ単一選択・
// 選択中のボタンの再クリックで解除(null=絞り込みなし)。両方指定時は両方に一致するもの。
// どちらも未指定なら全候補を表示する(並びは装備レベル降順)。
// シーズン4でS4装備(GS320台/340台/360台、最上位380)向けに切り替えた(S3は220/240/260台)。
// 「Lv300未満」は過去シーズン以前の装備をまとめて見るための帯。
export type CandidateGsFilter = 'below300' | 'lv320' | 'lv340' | 'lv360';

export const CANDIDATE_GS_FILTERS: CandidateGsFilter[] = ['below300', 'lv320', 'lv340', 'lv360'];

export function isCandidateGsMatch(item: EquipmentItem, filter: CandidateGsFilter): boolean {
  switch (filter) {
    case 'below300':
      return item.equipGs < 300;
    case 'lv320':
      return item.equipGs >= 320 && item.equipGs < 340;
    case 'lv340':
      return item.equipGs >= 340 && item.equipGs < 360;
    case 'lv360':
      return item.equipGs >= 360;
  }
}

// 種別の絞り込み。
//   伝説: 武器は暁光・蒼海シリーズと各種レイド武器(名前が赤字=quality 5)。防具・アクセサリは
//         レイド防具(接頭辞「[虚妄]」「[滅妄]」「[追光]」「[輝願]」「[夢紡ぎ]」「[夢入り]」
//         「[ルーン]」「[虚空]」等)で、データ上はセット装備(suitId あり)と一致する
//         (セット装備はレイド防具のみで、武器・極・匠にはない)。アクセサリ(耳飾り/首飾り/指輪/
//         護符)には該当が無い。
//   極/匠: 装備名の接頭辞「[極]」「[匠]」の装備(EquipmentItem.variantTag)。
export type CandidateKindFilter = 'legendary' | 'kiwami' | 'takumi';

export const CANDIDATE_KIND_FILTERS: CandidateKindFilter[] = ['legendary', 'kiwami', 'takumi'];

export function isCandidateKindMatch(item: EquipmentItem, filter: CandidateKindFilter): boolean {
  switch (filter) {
    case 'legendary':
      return item.quality === 5 || isSeaBreezeSeries(item) || item.suitId != null;
    case 'kiwami':
    case 'takumi':
      return item.variantTag === filter;
  }
}

// 候補一覧に表示する候補(絞り込みに一致するもの+現在の選択値)。並びは呼び出し側で決める。
// 欠番になった装備(名前に【廃棄】を含む。EquipmentItem.discarded)は、選択中でない限り表示しない。
export function filterCandidates(
  candidates: readonly EquipmentItem[],
  gsFilter: CandidateGsFilter | null,
  kindFilter: CandidateKindFilter | null,
  selectedId: number | undefined,
): EquipmentItem[] {
  return candidates.filter(
    (c) =>
      c.id === selectedId ||
      (!c.discarded &&
        (!gsFilter || isCandidateGsMatch(c, gsFilter)) &&
        (!kindFilter || isCandidateKindMatch(c, kindFilter))),
  );
}

// EquipmentPanelのGS帯フィルター初期値。クライアントの現在日時に応じて、その時点で
// 実質的に一番「旬」なGS帯を既定選択にする(ユーザーが毎回手動で切り替えずに済むように)。
// GsScheduleTier('lv320'/'lv340'/'lv360')はCandidateGsFilterの部分集合のため、
// スケジュール判定(seasonSchedule.ts)をそのまま利用できる。
export function getDefaultCandidateGsFilter(now: Date = new Date()): CandidateGsFilter {
  return getGsScheduleTier(now);
}
