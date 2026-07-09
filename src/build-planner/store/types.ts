import type { EquipmentSlice } from './equipmentSlice';
import type { ModuleSlice } from './moduleSlice';
import type { PhantomSlice } from './phantomSlice';
import type { PlanSlice } from './planSlice';
import type { SkillSlice } from './skillSlice';
import type { TalentSlice } from './talentSlice';

export type BuildStore = EquipmentSlice &
  TalentSlice &
  SkillSlice &
  ModuleSlice &
  PhantomSlice &
  PlanSlice;
