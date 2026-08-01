import type { StateCreator } from 'zustand';
import { STATIC_AUTOSAVE_DEFAULTS } from '../plan/planDefaults';
import {
  hasLegacyPhantomFactor,
  initPhantomNodeSelections,
  isTemplateLocked,
  type PhantomFactorSlotValue,
} from '../phantom/phantomData';
import { getAutoSaveOnMount } from './autoSaveOnMount';
import type { BuildStore } from './types';

export interface PhantomSlice {
  phantomEnabled: boolean;
  phantomLevel: number;
  phantomTemplateId: number | null;
  phantomBondPoints: number;
  phantomNodeSelections: Record<number, number>;
  phantomFactorSlots: Record<number, PhantomFactorSlotValue | null>;
  setPhantomEnabled: (enabled: boolean) => void;
  setPhantomLevel: (level: number) => void;
  // インタラクティブ用: テンプレート変更時、そのツリー未選択箇所をデフォルト値で
  // 補完する副作用を持つ(他ツリー分の選択/因子装着は保持したまま切り替わる)。
  setPhantomTemplateId: (id: number | null) => void;
  // 生セッター。プラン読込/リセット専用(上記の副作用を発火させない)。
  setPhantomTemplateIdState: (id: number | null) => void;
  setPhantomBondPoints: (points: number) => void;
  setPhantomNodeSelection: (sameGroupId: number, nodeId: number) => void;
  setPhantomNodeSelectionsState: (selections: Record<number, number>) => void;
  setPhantomFactorSlot: (groupId: number, factor: PhantomFactorSlotValue | null) => void;
  setPhantomFactorSlotsState: (slots: Record<number, PhantomFactorSlotValue | null>) => void;
}

export const createPhantomSlice: StateCreator<BuildStore, [], [], PhantomSlice> = (set) => {
  const autoSaveOnMount = getAutoSaveOnMount().state;
  // 過去シーズン(S2)の幻影因子が装着されたままの自動保存データは、潜在Lv/絆レベルポイント/
  // 因子装着/ノード選択状況をリセットする(通知はPlanSlice側のphantomLegacyFactorResetNotice、
  // 同じhasLegacyPhantomFactor判定をautoSaveOnMount.state.phantomFactorSlotsに対して行う)。
  const hasLegacyFactorOnMount = hasLegacyPhantomFactor(autoSaveOnMount?.phantomFactorSlots);
  const initialPhantomLevel = hasLegacyFactorOnMount
    ? 1
    : (autoSaveOnMount?.phantomLevel ?? STATIC_AUTOSAVE_DEFAULTS.phantomLevel);
  const initialPhantomTemplateId =
    autoSaveOnMount?.phantomTemplateId ?? STATIC_AUTOSAVE_DEFAULTS.phantomTemplateId;
  // 未開放のツリーがONのまま保存/読込されたデータは、起動時にOFFへ矯正する
  // (setPhantomTemplateId/setPhantomLevelの自動OFFと同じ判定基準)。
  const initialPhantomEnabled =
    (autoSaveOnMount?.phantomEnabled ?? STATIC_AUTOSAVE_DEFAULTS.phantomEnabled) &&
    !isTemplateLocked(initialPhantomTemplateId, initialPhantomLevel);

  return {
    phantomEnabled: initialPhantomEnabled,
    phantomLevel: initialPhantomLevel,
    phantomTemplateId: initialPhantomTemplateId,
    phantomBondPoints: hasLegacyFactorOnMount
      ? 0
      : (autoSaveOnMount?.phantomBondPoints ?? STATIC_AUTOSAVE_DEFAULTS.phantomBondPoints),
    phantomNodeSelections: hasLegacyFactorOnMount
      ? autoSaveOnMount?.phantomTemplateId != null
        ? initPhantomNodeSelections(autoSaveOnMount.phantomTemplateId)
        : {}
      : autoSaveOnMount?.phantomNodeSelections
        ? autoSaveOnMount.phantomNodeSelections
        : autoSaveOnMount?.phantomTemplateId != null
          ? initPhantomNodeSelections(autoSaveOnMount.phantomTemplateId)
          : {},
    phantomFactorSlots: hasLegacyFactorOnMount
      ? {}
      : (autoSaveOnMount?.phantomFactorSlots ?? STATIC_AUTOSAVE_DEFAULTS.phantomFactorSlots),

    // 未開放のツリーを選択中は、手動でONにする操作を無視する(自動OFF後に再びONへ戻せて
    // しまうと自動OFFの意味がなくなるため)。OFFにする操作は常に許可する。
    setPhantomEnabled: (phantomEnabled) =>
      set((state) => ({
        phantomEnabled:
          phantomEnabled && isTemplateLocked(state.phantomTemplateId, state.phantomLevel)
            ? state.phantomEnabled
            : phantomEnabled,
      })),
    setPhantomLevel: (phantomLevel) =>
      set((state) => ({
        phantomLevel,
        // ツリーが未開放になった(またはなったまま)場合、ONなら自動でOFFにする。
        phantomEnabled:
          state.phantomEnabled && isTemplateLocked(state.phantomTemplateId, phantomLevel)
            ? false
            : state.phantomEnabled,
      })),
    setPhantomTemplateIdState: (phantomTemplateId) => set({ phantomTemplateId }),
    setPhantomBondPoints: (phantomBondPoints) => set({ phantomBondPoints }),
    setPhantomNodeSelectionsState: (phantomNodeSelections) => set({ phantomNodeSelections }),
    setPhantomFactorSlotsState: (phantomFactorSlots) => set({ phantomFactorSlots }),

    setPhantomTemplateId: (id) =>
      set((state) => ({
        phantomTemplateId: id,
        // groupId/sameGroupIdはテンプレートをまたいで重複しないため、他ツリー分のキーを
        // 残したままマージしても計算(getActivePhantomNodeIds等)には影響しない。これにより
        // ツリーを切り替えても各ツリーの選択/因子装着状況が保持される。
        phantomNodeSelections:
          id != null
            ? { ...initPhantomNodeSelections(id), ...state.phantomNodeSelections }
            : state.phantomNodeSelections,
        // 未開放のツリーを選択した場合、ONなら自動でOFFにする。
        phantomEnabled:
          state.phantomEnabled && isTemplateLocked(id, state.phantomLevel)
            ? false
            : state.phantomEnabled,
      })),

    setPhantomNodeSelection: (sameGroupId, nodeId) =>
      set((state) => ({
        phantomNodeSelections: { ...state.phantomNodeSelections, [sameGroupId]: nodeId },
      })),

    setPhantomFactorSlot: (groupId, factor) =>
      set((state) => ({
        phantomFactorSlots: { ...state.phantomFactorSlots, [groupId]: factor },
      })),
  };
};
