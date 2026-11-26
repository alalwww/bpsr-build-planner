import type { StateCreator } from 'zustand';
import {
  addPreset,
  deletePreset,
  loadPresets,
  overwritePreset,
  persistPresets,
  renamePreset,
} from '../components/preset/presetStorage';
import { MODULE_PRESETS_STORAGE_KEY, type ModulePreset } from '../module/modulePresets';
import type { BuildStore } from './types';

export interface ModulePresetSlice {
  modulePresets: ModulePreset[];
  // 現在ロード中のプリセットID。プリセットからロードされていない(または直近の保存/削除で
  // 対応が切れた)場合はnull。ビルドプラン/自動保存/共有コードには含めないセッション限りの
  // UI状態のため、ここではlocalStorageへは保存せずストアのメモリ上にのみ保持する
  // (モジュールタブの再マウントをまたいで保持したいのでコンポーネントローカルstateにはしない)。
  loadedModulePresetId: string | null;
  saveModulePreset: (name: string) => void;
  overwriteModulePreset: (id: string, name: string) => void;
  renameModulePreset: (id: string, newName: string) => void;
  deleteModulePreset: (id: string) => void;
  loadModulePreset: (id: string) => void;
}

export const createModulePresetSlice: StateCreator<BuildStore, [], [], ModulePresetSlice> = (
  set,
  get,
) => {
  const update = (presets: ModulePreset[], patch: Partial<ModulePresetSlice> = {}) => {
    persistPresets(MODULE_PRESETS_STORAGE_KEY, presets);
    set({ modulePresets: presets, ...patch });
  };

  return {
    modulePresets: loadPresets<ModulePreset>(MODULE_PRESETS_STORAGE_KEY),
    loadedModulePresetId: null,

    saveModulePreset: (name) => {
      const state = get();
      const { presets, added } = addPreset(state.modulePresets, name, {
        moduleSlots: state.moduleSlots,
      });
      update(presets, { loadedModulePresetId: added.id });
    },

    overwriteModulePreset: (id, name) => {
      const state = get();
      update(overwritePreset(state.modulePresets, id, name, { moduleSlots: state.moduleSlots }), {
        loadedModulePresetId: id,
      });
    },

    renameModulePreset: (id, newName) => {
      update(renamePreset(get().modulePresets, id, newName));
    },

    deleteModulePreset: (id) => {
      const state = get();
      update(deletePreset(state.modulePresets, id), {
        loadedModulePresetId: state.loadedModulePresetId === id ? null : state.loadedModulePresetId,
      });
    },

    loadModulePreset: (id) => {
      const state = get();
      const preset = state.modulePresets.find((p) => p.id === id);
      if (!preset) return;
      state.setModuleSlotsState(preset.moduleSlots);
      set({ loadedModulePresetId: id });
    },
  };
};
