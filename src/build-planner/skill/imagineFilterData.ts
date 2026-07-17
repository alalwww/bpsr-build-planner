import type { ImagineData } from '../stats/gameData';

// ---- バトルイマジン選択候補の絞り込み(シーズン/品質フィルター) ----
// 装備選択のGS帯フィルター(equipmentSlotPickerData.ts の CandidateGsFilter)と異なり、
// こちらは「非該当を一覧から隠す」フィルター(2グループ独立・AND条件、いずれも
// 選択中のボタンを再クリックすると解除できる=null で表現)。
//
// SkillAoyiTable.Classification=4(コラボ)は SeasonId が実データ上 S3 を指していても、
// シーズン/品質どちらの通常フィルターにも一致させず、「コラボ」フィルターでのみ表示する。

export type ImagineSeasonFilter = 's1' | 's2' | 's3' | 'collab';
export const IMAGINE_SEASON_FILTERS: ImagineSeasonFilter[] = ['s1', 's2', 's3', 'collab'];

export type ImagineQualityFilter = 'spOrange' | 'orange' | 'purple';
export const IMAGINE_QUALITY_FILTERS: ImagineQualityFilter[] = ['spOrange', 'orange', 'purple'];

const COLLAB_CLASSIFICATION = 4;

export function getImagineSeasonFilter(bi: ImagineData): ImagineSeasonFilter {
  if (bi.classification === COLLAB_CLASSIFICATION) return 'collab';
  return `s${bi.seasonId}` as ImagineSeasonFilter;
}

// コラボ限定イマジンは品質フィルターの対象外(いずれにも一致しない)。
export function getImagineQualityFilter(bi: ImagineData): ImagineQualityFilter | null {
  switch (bi.classification) {
    case 1:
      return 'purple';
    case 2:
      return 'orange';
    case 3:
      return 'spOrange';
    default:
      return null;
  }
}

export function isImagineFilterMatch(
  bi: ImagineData,
  seasonFilter: ImagineSeasonFilter | null,
  qualityFilter: ImagineQualityFilter | null,
): boolean {
  if (seasonFilter !== null && getImagineSeasonFilter(bi) !== seasonFilter) return false;
  if (qualityFilter !== null && getImagineQualityFilter(bi) !== qualityFilter) return false;
  return true;
}
