import type { EquipmentSlice } from './equipmentSlice';
import type { ModuleSlice } from './moduleSlice';
import type { ModulePresetSlice } from './modulePresetSlice';
import type { PhantomSlice } from './phantomSlice';
import type { PlanSlice } from './planSlice';
import type { SkillSlice } from './skillSlice';
import type { TalentSlice } from './talentSlice';

export type BuildStore = EquipmentSlice &
  TalentSlice &
  SkillSlice &
  ModuleSlice &
  ModulePresetSlice &
  PhantomSlice &
  PlanSlice;
