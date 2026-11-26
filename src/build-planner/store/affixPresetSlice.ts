import type { StateCreator } from 'zustand';
import {
  addPreset,
  deletePreset,
  loadPresets,
  overwritePreset,
  persistPresets,
  renamePreset,
} from '../components/preset/presetStorage';
import {
  AFFIX_PRESETS_STORAGE_KEY,
  type AffixPreset,
  type AffixPresetContent,
} from '../phantom/affixPresets';
import type { BuildStore } from './types';

// 映痕プリセット(因子設定ダイアログ)。ビルドプラン/自動保存/共有コードには含めない。
// どのプリセットをロード中かは因子スロットごと・ダイアログを開いている間だけの表示状態のため、
// ダイアログ側のローカル state で持つ(モジュールプリセットの loadedModulePresetId とは異なる)。
export interface AffixPresetSlice {
  affixPresets: AffixPreset[];
  /** 追加したプリセットの id を返す。 */
  saveAffixPreset: (name: string, content: AffixPresetContent) => string;
  overwriteAffixPreset: (id: string, name: string, content: AffixPresetContent) => void;
  renameAffixPreset: (id: string, newName: string) => void;
  deleteAffixPreset: (id: string) => void;
}

export const createAffixPresetSlice: StateCreator<BuildStore, [], [], AffixPresetSlice> = (
  set,
  get,
) => {
  const update = (presets: AffixPreset[]) => {
    persistPresets(AFFIX_PRESETS_STORAGE_KEY, presets);
    set({ affixPresets: presets });
  };

  return {
    affixPresets: loadPresets<AffixPreset>(AFFIX_PRESETS_STORAGE_KEY),

    saveAffixPreset: (name, content) => {
      const { presets, added } = addPreset(get().affixPresets, name, content);
      update(presets);
      return added.id;
    },

    overwriteAffixPreset: (id, name, content) => {
      update(overwritePreset(get().affixPresets, id, name, content));
    },

    renameAffixPreset: (id, newName) => {
      update(renamePreset(get().affixPresets, id, newName));
    },

    deleteAffixPreset: (id) => {
      update(deletePreset(get().affixPresets, id));
    },
  };
};
