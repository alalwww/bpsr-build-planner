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
import { AFFIX_QUALITIES } from '../phantom/phantomAffixData';
import type { BuildStore } from './types';

// 映痕を選んだときの既定の品質(レアリティ)。因子設定ダイアログのレアリティ一括変更で選んだ値を
// 全因子共通で覚えておく(ビルドプラン等とは独立したローカル設定)。
const AFFIX_DEFAULT_QUALITY_STORAGE_KEY = 'bpsr-affix-default-quality-v1';
// 保存された値が無いときの既定の品質(エピック)。
const AFFIX_INITIAL_DEFAULT_QUALITY = 4;

function loadAffixDefaultQuality(): number {
  try {
    const raw = Number(localStorage.getItem(AFFIX_DEFAULT_QUALITY_STORAGE_KEY));
    if (AFFIX_QUALITIES.includes(raw)) return raw;
  } catch {
    // storage unavailable
  }
  return AFFIX_QUALITIES.includes(AFFIX_INITIAL_DEFAULT_QUALITY)
    ? AFFIX_INITIAL_DEFAULT_QUALITY
    : AFFIX_QUALITIES[0];
}

// 映痕プリセットと映痕の既定の品質(因子設定ダイアログ)。ビルドプラン/自動保存/共有コードには含めない。
// どのプリセットをロード中かは因子スロットごと・ダイアログを開いている間だけの表示状態のため、
// ダイアログ側のローカル state で持つ(モジュールプリセットの loadedModulePresetId とは異なる)。
export interface AffixPresetSlice {
  affixPresets: AffixPreset[];
  /** 追加したプリセットの id を返す。 */
  saveAffixPreset: (name: string, content: AffixPresetContent) => string;
  overwriteAffixPreset: (id: string, name: string, content: AffixPresetContent) => void;
  renameAffixPreset: (id: string, newName: string) => void;
  deleteAffixPreset: (id: string) => void;
  /** 映痕を選んだときの既定の品質(レアリティ一括変更で選んだ値)。 */
  affixDefaultQuality: number;
  setAffixDefaultQuality: (quality: number) => void;
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

    affixDefaultQuality: loadAffixDefaultQuality(),
    setAffixDefaultQuality: (quality) => {
      try {
        localStorage.setItem(AFFIX_DEFAULT_QUALITY_STORAGE_KEY, String(quality));
      } catch {
        // quota exceeded or storage unavailable
      }
      set({ affixDefaultQuality: quality });
    },
  };
};
