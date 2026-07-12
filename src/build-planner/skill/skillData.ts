import skillsDataRaw from '../../data/skills.json';
import { imagineDataById, type ImagineData } from '../stats/gameData';

const _skillMods = import.meta.glob<{ default: string }>(
  ['../../assets/skills/*.png', '!../../assets/skills/* #*.png'],
  { eager: true },
);
const _imagineMods = import.meta.glob<{ default: string }>('../../assets/skills_imagines/*.png', {
  eager: true,
});

export function getSkillIconUrl(iconPath: string): string | undefined {
  const filename = iconPath.split('/').pop();
  if (!filename) return undefined;
  return _skillMods[`../../assets/skills/${filename}.png`]?.default;
}

export function getImagineIconUrl(iconName: string): string | undefined {
  return _imagineMods[`../../assets/skills_imagines/${iconName}.png`]?.default;
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
