import type { StateCreator } from 'zustand';
import { DEFAULT_PROFESSION_KEY, PROFESSIONS } from '../profession';
import { initTalentR1Ids, initTalentR2Ids } from '../stats/gameData';
import { getAutoSaveOnMount } from './autoSaveOnMount';
import type { BuildStore } from './types';

// talentNodesById / r1NodeCount / skillReplacements は profession に依存する派生値のため
// ストアには保持せず、derivedSelectors.ts のメモ化selectorとして計算する。

export interface TalentSlice {
  talentR1EnabledIds: Set<number>;
  talentR2EnabledIds: Set<number>;
  setTalentR1EnabledIds: (ids: Set<number>) => void;
  setTalentR2EnabledIds: (ids: Set<number>) => void;
  // 転職時にR1/R2両方を初期状態へ戻す。
  resetTalentForProfessionChange: (professionId: number) => void;
  // プロフェッションタイプ(type1/type2)切り替え時にR2のみ初期状態へ戻す。
  resetTalentR2ForType: (professionId: number, bdType: 0 | 1) => void;
}

export const createTalentSlice: StateCreator<BuildStore, [], [], TalentSlice> = (set) => {
  const autoSaveOnMount = getAutoSaveOnMount();
  const defaultProfessionId = PROFESSIONS[DEFAULT_PROFESSION_KEY].professionId;

  return {
    talentR1EnabledIds: autoSaveOnMount?.talentR1EnabledIds
      ? new Set(autoSaveOnMount.talentR1EnabledIds)
      : initTalentR1Ids(defaultProfessionId),
    talentR2EnabledIds: autoSaveOnMount?.talentR2EnabledIds
      ? new Set(autoSaveOnMount.talentR2EnabledIds)
      : initTalentR2Ids(defaultProfessionId, 0),

    setTalentR1EnabledIds: (talentR1EnabledIds) => set({ talentR1EnabledIds }),
    setTalentR2EnabledIds: (talentR2EnabledIds) => set({ talentR2EnabledIds }),

    resetTalentForProfessionChange: (professionId) =>
      set({
        talentR1EnabledIds: initTalentR1Ids(professionId),
        talentR2EnabledIds: initTalentR2Ids(professionId, 0),
      }),

    resetTalentR2ForType: (professionId, bdType) =>
      set({ talentR2EnabledIds: initTalentR2Ids(professionId, bdType) }),
  };
};
