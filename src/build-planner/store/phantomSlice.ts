import type { StateCreator } from 'zustand';
import { STATIC_AUTOSAVE_DEFAULTS } from '../planDefaults';
import {
  hasLegacyPhantomFactor,
  initPhantomNodeSelections,
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
  // インタラクティブ用: テンプレート変更時にnode/factor選択をリセットする副作用を持つ。
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

  return {
    phantomEnabled: autoSaveOnMount?.phantomEnabled ?? STATIC_AUTOSAVE_DEFAULTS.phantomEnabled,
    phantomLevel: hasLegacyFactorOnMount
      ? 1
      : (autoSaveOnMount?.phantomLevel ?? STATIC_AUTOSAVE_DEFAULTS.phantomLevel),
    phantomTemplateId:
      autoSaveOnMount?.phantomTemplateId ?? STATIC_AUTOSAVE_DEFAULTS.phantomTemplateId,
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

    setPhantomEnabled: (phantomEnabled) => set({ phantomEnabled }),
    setPhantomLevel: (phantomLevel) => set({ phantomLevel }),
    setPhantomTemplateIdState: (phantomTemplateId) => set({ phantomTemplateId }),
    setPhantomBondPoints: (phantomBondPoints) => set({ phantomBondPoints }),
    setPhantomNodeSelectionsState: (phantomNodeSelections) => set({ phantomNodeSelections }),
    setPhantomFactorSlotsState: (phantomFactorSlots) => set({ phantomFactorSlots }),

    setPhantomTemplateId: (id) =>
      set({
        phantomTemplateId: id,
        phantomNodeSelections: id != null ? initPhantomNodeSelections(id) : {},
        phantomFactorSlots: {},
      }),

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
