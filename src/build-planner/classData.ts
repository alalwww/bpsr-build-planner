import classesDataRaw from '../data/classes.json';

// classes.json(ProfessionSystemTable由来)の単一の定義元。
// これまで gameData.ts / skill/skillData.ts / talent/talentTreeData.ts /
// CharacterPanel / ProfessionPicker / profession.ts がそれぞれ独自の部分型で
// 再パースしていたのを、この型に一本化する。
// (クラスの計算係数やキーは ./profession.ts の PROFESSIONS を参照。こちらは
// ZTable由来の生データ側。)
export interface ClassData {
  id: number;
  // ロール(1=攻撃/2=支援/3=防御)。タレントツリーのテーマ色・クラス一覧の並び順に使用。
  talent?: number;
  // 実装済み(選択可能)クラスか。
  isOpen: boolean;
  icon: string;
  normalAttackSkill: number[];
  specialSkill: number[];
  ultimateSkill: number[];
  normalSkill: number[];
  talentSkill: number[];
  roleSkill: number[];
  // ProfessionSystemTable.ShowTalentStage: [type1のTalentSchoolId, type2のTalentSchoolId]
  showTalentStage: number[];
  // ロールのテーマ色(例: "#b13f3f")。UI背景のティントに使用。
  talentColor?: string;
}

export const classesData = classesDataRaw as unknown as Record<string, ClassData>;

export function getClassData(professionId: number): ClassData | undefined {
  return classesData[String(professionId)];
}
