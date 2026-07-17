import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import { persistAutoSave } from '../buildPlan';
import { createEquipmentSlice } from './equipmentSlice';
import { createModuleSlice } from './moduleSlice';
import { createPhantomSlice } from './phantomSlice';
import { createPlanSlice } from './planSlice';
import { createSkillSlice } from './skillSlice';
import { createTalentSlice } from './talentSlice';
import type { BuildStore } from './types';

export const useBuildStore = create<BuildStore>()(
  subscribeWithSelector((...a) => ({
    ...createEquipmentSlice(...a),
    ...createTalentSlice(...a),
    ...createSkillSlice(...a),
    ...createModuleSlice(...a),
    ...createPhantomSlice(...a),
    ...createPlanSlice(...a),
  })),
);

// 自動保存: 元の useBuildState.ts の
// `useEffect(() => persistAutoSave(...), [planName, ...Object.values(rawAutoSaveFields)])`
// と同じフィールド集合をshallow比較で購読し、いずれかが変わるたびlocalStorageへ保存する。
// cookingBuffはセッション限りの一時入力のため、元の実装と同様に対象外。
function selectAutoSaveFields(state: BuildStore) {
  return [
    state.planName,
    state.professionKey,
    state.professionTypeKey,
    state.equipped,
    state.refineLevels,
    state.perfectlines,
    state.evolutionStats,
    state.legendaryAffixState,
    state.legendaryAffixGroupState,
    state.slotEnchants,
    state.masteryEquipped,
    state.masteryLevels,
    state.masteryRanks,
    state.fixedLevels,
    state.fixedRanks,
    state.battleImagines,
    state.imagineRanks,
    state.talentR1EnabledIds,
    state.talentR2EnabledIds,
    state.moduleSlots,
    state.adventurerLevel,
    state.phantomEnabled,
    state.phantomLevel,
    state.phantomTemplateId,
    state.phantomBondPoints,
    state.phantomNodeSelections,
    state.phantomFactorSlots,
  ] as const;
}

useBuildStore.subscribe(
  selectAutoSaveFields,
  () => {
    persistAutoSave(useBuildStore.getState().buildAutoSaveState());
  },
  { equalityFn: shallow },
);
