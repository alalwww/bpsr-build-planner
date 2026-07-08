import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import { setAtIndex, swapAtIndex, withIndex } from '../arrayState';
import type { ProfessionKey } from '../profession';
import { PROFESSIONS } from '../profession';
import { getClassData } from '../stats/gameData';
import { STATIC_AUTOSAVE_DEFAULTS } from '../planDefaults';

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

export interface SkillStateResult {
  masteryEquipped: boolean[];
  masteryLevels: number[];
  masteryRanks: number[];
  // 生の全配列セッター。プラン読込/リセット/転職(useBuildState.ts側)専用。
  setMasteryEquippedState: Dispatch<SetStateAction<boolean[]>>;
  setMasteryLevelsState: Dispatch<SetStateAction<number[]>>;
  setMasteryRanksState: Dispatch<SetStateAction<number[]>>;
  fixedLevels: number[];
  fixedRanks: number[];
  setFixedLevelsState: Dispatch<SetStateAction<number[]>>;
  setFixedRanksState: Dispatch<SetStateAction<number[]>>;
  battleImaginaries: (number | null)[];
  imaginaryRanks: number[];
  setBattleImaginariesState: Dispatch<SetStateAction<(number | null)[]>>;
  setImaginaryRanksState: Dispatch<SetStateAction<number[]>>;
  toggleMasteryEquipped: (index: number) => void;
  setMasteryLevel: (index: number, level: number) => void;
  setMasteryRank: (index: number, rank: number) => void;
  setFixedLevel: (index: number, level: number) => void;
  setFixedRank: (index: number, rank: number) => void;
  setBattleImaginary: (index: number, id: number | null) => void;
  setImaginaryRank: (index: number, rank: number) => void;
  reorderBattleImaginaries: (fromIndex: number, toIndex: number) => void;
  // 転職時にマスタリー/固定スキルをリセットする(バトルイマジンは引き継ぐため対象外)。
  resetForProfessionChange: (profKey: ProfessionKey) => void;
}

export function useSkillState(
  initialProfessionKey: ProfessionKey,
  initial: {
    masteryEquipped?: boolean[];
    masteryLevels?: number[];
    masteryRanks?: number[];
    fixedLevels?: number[];
    fixedRanks?: number[];
    battleImaginaries?: (number | null)[];
    imaginaryRanks?: number[];
  },
): SkillStateResult {
  const defaultCount = normalSkillCount(initialProfessionKey);
  const [masteryEquipped, setMasteryEquippedState] = useState<boolean[]>(
    () => initial.masteryEquipped ?? initMasteryEquipped(defaultCount),
  );
  const [masteryLevels, setMasteryLevelsState] = useState<number[]>(
    () => initial.masteryLevels ?? initMasteryLevels(defaultCount),
  );
  const [masteryRanks, setMasteryRanksState] = useState<number[]>(
    () => initial.masteryRanks ?? initMasteryRanks(defaultCount),
  );

  const [fixedLevels, setFixedLevelsState] = useState<number[]>(
    () => initial.fixedLevels ?? STATIC_AUTOSAVE_DEFAULTS.fixedLevels,
  );
  const [fixedRanks, setFixedRanksState] = useState<number[]>(
    () => initial.fixedRanks ?? STATIC_AUTOSAVE_DEFAULTS.fixedRanks,
  );

  const [battleImaginaries, setBattleImaginariesState] = useState<(number | null)[]>(
    () => initial.battleImaginaries ?? STATIC_AUTOSAVE_DEFAULTS.battleImaginaries,
  );
  const [imaginaryRanks, setImaginaryRanksState] = useState<number[]>(
    () => initial.imaginaryRanks ?? STATIC_AUTOSAVE_DEFAULTS.imaginaryRanks,
  );

  const toggleMasteryEquipped = (index: number) => {
    setMasteryEquippedState((prev) => {
      const equippedCount = prev.filter(Boolean).length;
      if (!prev[index] && equippedCount >= 4) return prev;
      return withIndex(prev, index, !prev[index]);
    });
  };

  const setMasteryLevel = (index: number, level: number) =>
    setAtIndex(setMasteryLevelsState, index, level);

  const setMasteryRank = (index: number, rank: number) =>
    setAtIndex(setMasteryRanksState, index, rank);

  const setFixedLevel = (index: number, level: number) =>
    setAtIndex(setFixedLevelsState, index, level);

  const setFixedRank = (index: number, rank: number) => setAtIndex(setFixedRanksState, index, rank);

  const setBattleImaginary = (index: number, id: number | null) =>
    setAtIndex(setBattleImaginariesState, index, id);

  const setImaginaryRank = (index: number, rank: number) =>
    setAtIndex(setImaginaryRanksState, index, rank);

  const reorderBattleImaginaries = (fromIndex: number, toIndex: number) => {
    setBattleImaginariesState((prev) => swapAtIndex(prev, fromIndex, toIndex));
    setImaginaryRanksState((prev) => swapAtIndex(prev, fromIndex, toIndex));
  };

  const resetForProfessionChange = (profKey: ProfessionKey) => {
    const newCount = normalSkillCount(profKey);
    setMasteryEquippedState(initMasteryEquipped(newCount));
    setMasteryLevelsState(initMasteryLevels(newCount));
    setMasteryRanksState(initMasteryRanks(newCount));
    setFixedLevelsState(STATIC_AUTOSAVE_DEFAULTS.fixedLevels);
    setFixedRanksState(STATIC_AUTOSAVE_DEFAULTS.fixedRanks);
  };

  return {
    masteryEquipped,
    masteryLevels,
    masteryRanks,
    setMasteryEquippedState,
    setMasteryLevelsState,
    setMasteryRanksState,
    fixedLevels,
    fixedRanks,
    setFixedLevelsState,
    setFixedRanksState,
    battleImaginaries,
    imaginaryRanks,
    setBattleImaginariesState,
    setImaginaryRanksState,
    toggleMasteryEquipped,
    setMasteryLevel,
    setMasteryRank,
    setFixedLevel,
    setFixedRank,
    setBattleImaginary,
    setImaginaryRank,
    reorderBattleImaginaries,
    resetForProfessionChange,
  };
}
