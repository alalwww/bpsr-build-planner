import type { StateCreator } from 'zustand';
import { withIndex } from '../arrayState';
import { STATIC_AUTOSAVE_DEFAULTS } from '../planDefaults';
import type { ModuleConfig, ModuleSlots } from '../types';
import { getAutoSaveOnMount } from './autoSaveOnMount';
import type { BuildStore } from './types';

export interface ModuleSlice {
  moduleSlots: ModuleSlots;
  // 生の全スロットセッター。プラン読込/リセット専用。
  setModuleSlotsState: (slots: ModuleSlots) => void;
  setModuleSlot: (index: number, config: ModuleConfig | null) => void;
}

export const createModuleSlice: StateCreator<BuildStore, [], [], ModuleSlice> = (set, get) => {
  const autoSaveOnMount = getAutoSaveOnMount().state;

  return {
    moduleSlots: autoSaveOnMount?.moduleSlots ?? STATIC_AUTOSAVE_DEFAULTS.moduleSlots,

    setModuleSlotsState: (moduleSlots) => set({ moduleSlots }),

    setModuleSlot: (index, config) =>
      set({ moduleSlots: withIndex(get().moduleSlots, index, config) }),
  };
};
