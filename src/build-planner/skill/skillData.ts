import classesDataRaw from '../../data/classes.json';
import skillsDataRaw from '../../data/skills.json';
import battleImaginesRaw from '../../data/battle-imagines.json';

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

export interface ClassData {
  normalAttackSkill: number[];
  specialSkill: number[];
  ultimateSkill: number[];
  normalSkill: number[];
  roleSkill: number[];
}

export interface SkillData {
  icon: string;
  maxRank: number;
}

export interface BattleImagineData {
  id: number;
  rarityType: number;
  icon: string;
  maxRank: number;
  passiveEffects?: number[][];
}

export const classesData = classesDataRaw as Record<string, ClassData>;
export const skillsData = skillsDataRaw as Record<string, SkillData>;
export const battleImaginesData = battleImaginesRaw as Record<string, BattleImagineData>;

export function getSkillData(id: number): SkillData | undefined {
  return skillsData[String(id)];
}

export function getBattleImagineData(id: number): BattleImagineData | undefined {
  return battleImaginesData[String(id)];
}
