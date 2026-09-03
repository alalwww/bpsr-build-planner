import type { StateCreator } from 'zustand';
import {
  loadModulePresets,
  persistModulePresets,
  type ModulePreset,
} from '../module/modulePresets';
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
  return {
    modulePresets: loadModulePresets(),
    loadedModulePresetId: null,

    saveModulePreset: (name) => {
      const state = get();
      const preset: ModulePreset = {
        id: crypto.randomUUID(),
        name,
        moduleSlots: state.moduleSlots,
      };
      const next = [preset, ...state.modulePresets];
      persistModulePresets(next);
      set({ modulePresets: next, loadedModulePresetId: preset.id });
    },

    overwriteModulePreset: (id, name) => {
      const state = get();
      const next = state.modulePresets.map((p) =>
        p.id === id ? { ...p, name, moduleSlots: state.moduleSlots } : p,
      );
      persistModulePresets(next);
      set({ modulePresets: next, loadedModulePresetId: id });
    },

    renameModulePreset: (id, newName) => {
      const state = get();
      const next = state.modulePresets.map((p) => (p.id === id ? { ...p, name: newName } : p));
      persistModulePresets(next);
      set({ modulePresets: next });
    },

    deleteModulePreset: (id) => {
      const state = get();
      const next = state.modulePresets.filter((p) => p.id !== id);
      persistModulePresets(next);
      set({
        modulePresets: next,
        loadedModulePresetId:
          state.loadedModulePresetId === id ? null : state.loadedModulePresetId,
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
