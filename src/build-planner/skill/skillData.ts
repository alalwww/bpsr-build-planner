import skillsDataRaw from '../../data/skills.json';
import { createAssetMap } from '../assetMap';
import { imagineDataById, type ImagineData } from '../stats/gameData';

const skillIcon = createAssetMap(
  import.meta.glob<{ default: string }>(
    ['../../assets/skills/*.png', '!../../assets/skills/* #*.png'],
    { eager: true },
  ),
);
const imagineIcon = createAssetMap(
  import.meta.glob<{ default: string }>('../../assets/skills_imagines/*.png', { eager: true }),
);

export function getSkillIconUrl(iconPath: string): string | undefined {
  const filename = iconPath.split('/').pop();
  if (!filename) return undefined;
  // 汎用ロールスキル(全ロール共通、シーズン3)はSkillTable上のアイコンが
  // バトルイマジンと同じ skill_aoyi_skill_icon_* を指すため、専用の
  // src/assets/skills/ に無ければ src/assets/skills_imagines/ にフォールバックする。
  return skillIcon(filename) ?? imagineIcon(filename);
}

export function getImagineIconUrl(iconName: string): string | undefined {
  return imagineIcon(iconName);
}

export interface SkillData {
  icon: string;
  maxRank: number;
}

// classes.json / battle-imagines.json の定義元はそれぞれ ../classData / ../stats/gameData。
// スキルパネル側の従来名で再エクスポートする。
export { classesData, type ClassData } from '../classData';
export type BattleImagineData = ImagineData;
export const battleImaginesData = imagineDataById;

export const skillsData = skillsDataRaw as Record<string, SkillData>;

export function getSkillData(id: number): SkillData | undefined {
  return skillsData[String(id)];
}

export function getBattleImagineData(id: number): BattleImagineData | undefined {
  return battleImaginesData[String(id)];
}
