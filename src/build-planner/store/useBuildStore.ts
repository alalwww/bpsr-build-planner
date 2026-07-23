import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import { persistAutoSave, persistBuildPlans } from '../plan/buildPlan';
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

// マウント時点でS2幻影因子のリセット(createPhantomSlice参照)が行われた場合、補正後の状態を
// 即座に永続化する(loadAutoSave()のv1→v2移行時のpersistAutoSaveと同じパターン)。
// これをしないと補正はメモリ上のみに留まりlocalStorageには古いデータが残ったままになり、
// 下の購読も「初期状態からの変化」しか検知しないためこの補正を保存できず、次回起動時に
// 同じ判定が再び真になって通知が毎回出続けてしまう。
if (useBuildStore.getState().phantomLegacyFactorResetNotice) {
  persistAutoSave(useBuildStore.getState().buildAutoSaveState());
}

// localStorageのデータ破損等でロードに失敗した場合、ストア自体はデフォルト状態で初期化
// されるが、壊れたデータ自体はlocalStorageに残ったままになる。これを放置すると次回起動時も
// 同じ破損データの読み込みに失敗し、何らかの変更を加えて再保存されるまで同じ失敗が
// 繰り返されてしまう(通知をdismissしてもストア上のフラグが消えるだけでlocalStorageは
// 直らない)。ロード失敗を検知した時点で、復元先となったデフォルト状態を即座に書き戻す。
if (useBuildStore.getState().autoSaveLoadError) {
  persistAutoSave(useBuildStore.getState().buildAutoSaveState());
}
if (useBuildStore.getState().planLoadError) {
  persistBuildPlans(useBuildStore.getState().buildPlans);
}

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
