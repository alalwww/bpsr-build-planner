import type { StateCreator } from 'zustand';
import { swapAtIndex, withIndex } from '../arrayState';
import { DEFAULT_PROFESSION_KEY, PROFESSIONS } from '../profession';
import type { ProfessionKey } from '../profession';
import { getClassData } from '../stats/gameData';
import { STATIC_AUTOSAVE_DEFAULTS } from '../planDefaults';
import { getAutoSaveOnMount } from './autoSaveOnMount';
import type { BuildStore } from './types';

export function normalSkillCount(profKey: ProfessionKey): number {
  return getClassData(PROFESSIONS[profKey].professionId)?.normalSkill.length ?? 0;
}

function initMasteryEquipped(size: number): boolean[] {
  return Array(size).fill(false);
}

function initMasteryLevels(size: number): number[] {
  return Array(size).fill(30);
}

function initMasteryRanks(size: number): number[] {
  return Array(size).fill(6);
}

export interface SkillSlice {
  masteryEquipped: boolean[];
  masteryLevels: number[];
  masteryRanks: number[];
  // 生の全配列セッター。プラン読込/リセット/転職専用。
  setMasteryEquippedState: (equipped: boolean[]) => void;
  setMasteryLevelsState: (levels: number[]) => void;
  setMasteryRanksState: (ranks: number[]) => void;
  fixedLevels: number[];
  fixedRanks: number[];
  setFixedLevelsState: (levels: number[]) => void;
  setFixedRanksState: (ranks: number[]) => void;
  battleImagines: (number | null)[];
  imagineRanks: number[];
  setBattleImaginesState: (imagines: (number | null)[]) => void;
  setImagineRanksState: (ranks: number[]) => void;
  toggleMasteryEquipped: (index: number) => void;
  setMasteryLevel: (index: number, level: number) => void;
  setMasteryRank: (index: number, rank: number) => void;
  setFixedLevel: (index: number, level: number) => void;
  setFixedRank: (index: number, rank: number) => void;
  setBattleImagine: (index: number, id: number | null) => void;
  setImagineRank: (index: number, rank: number) => void;
  reorderBattleImagines: (fromIndex: number, toIndex: number) => void;
  // 転職時にマスタリー/固定スキルをリセットする(バトルイマジンは引き継ぐため対象外)。
  resetSkillForProfessionChange: (profKey: ProfessionKey) => void;
}

export const createSkillSlice: StateCreator<BuildStore, [], [], SkillSlice> = (set, get) => {
  const autoSaveOnMount = getAutoSaveOnMount().state;
  const initialProfessionKey = autoSaveOnMount?.professionKey ?? DEFAULT_PROFESSION_KEY;
  const defaultCount = normalSkillCount(initialProfessionKey);

  return {
    masteryEquipped: autoSaveOnMount?.masteryEquipped ?? initMasteryEquipped(defaultCount),
    masteryLevels: autoSaveOnMount?.masteryLevels ?? initMasteryLevels(defaultCount),
    masteryRanks: autoSaveOnMount?.masteryRanks ?? initMasteryRanks(defaultCount),
    fixedLevels: autoSaveOnMount?.fixedLevels ?? STATIC_AUTOSAVE_DEFAULTS.fixedLevels,
    fixedRanks: autoSaveOnMount?.fixedRanks ?? STATIC_AUTOSAVE_DEFAULTS.fixedRanks,
    battleImagines: autoSaveOnMount?.battleImagines ?? STATIC_AUTOSAVE_DEFAULTS.battleImagines,
    imagineRanks: autoSaveOnMount?.imagineRanks ?? STATIC_AUTOSAVE_DEFAULTS.imagineRanks,

    setMasteryEquippedState: (masteryEquipped) => set({ masteryEquipped }),
    setMasteryLevelsState: (masteryLevels) => set({ masteryLevels }),
    setMasteryRanksState: (masteryRanks) => set({ masteryRanks }),
    setFixedLevelsState: (fixedLevels) => set({ fixedLevels }),
    setFixedRanksState: (fixedRanks) => set({ fixedRanks }),
    setBattleImaginesState: (battleImagines) => set({ battleImagines }),
    setImagineRanksState: (imagineRanks) => set({ imagineRanks }),

    toggleMasteryEquipped: (index) =>
      set((state) => {
        const prev = state.masteryEquipped;
        const equippedCount = prev.filter(Boolean).length;
        if (!prev[index] && equippedCount >= 4) return {};
        return { masteryEquipped: withIndex(prev, index, !prev[index]) };
      }),

    setMasteryLevel: (index, level) =>
      set({ masteryLevels: withIndex(get().masteryLevels, index, level) }),

    setMasteryRank: (index, rank) =>
      set({ masteryRanks: withIndex(get().masteryRanks, index, rank) }),

    setFixedLevel: (index, level) =>
      set({ fixedLevels: withIndex(get().fixedLevels, index, level) }),

    setFixedRank: (index, rank) => set({ fixedRanks: withIndex(get().fixedRanks, index, rank) }),

    setBattleImagine: (index, id) =>
      set({ battleImagines: withIndex(get().battleImagines, index, id) }),

    setImagineRank: (index, rank) =>
      set({ imagineRanks: withIndex(get().imagineRanks, index, rank) }),

    reorderBattleImagines: (fromIndex, toIndex) =>
      set((state) => ({
        battleImagines: swapAtIndex(state.battleImagines, fromIndex, toIndex),
        imagineRanks: swapAtIndex(state.imagineRanks, fromIndex, toIndex),
      })),

    resetSkillForProfessionChange: (profKey) => {
      const newCount = normalSkillCount(profKey);
      set({
        masteryEquipped: initMasteryEquipped(newCount),
        masteryLevels: initMasteryLevels(newCount),
        masteryRanks: initMasteryRanks(newCount),
        fixedLevels: STATIC_AUTOSAVE_DEFAULTS.fixedLevels,
        fixedRanks: STATIC_AUTOSAVE_DEFAULTS.fixedRanks,
      });
    },
  };
};
