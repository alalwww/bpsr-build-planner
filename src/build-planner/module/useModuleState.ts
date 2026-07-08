import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import { setAtIndex } from '../arrayState';
import type { ModuleConfig, ModuleSlots } from '../types';

export interface ModuleStateResult {
  moduleSlots: ModuleSlots;
  // 生の全スロットセッター。プラン読込/リセット(useBuildState.ts側)専用。
  setModuleSlotsState: Dispatch<SetStateAction<ModuleSlots>>;
  setModuleSlot: (index: number, config: ModuleConfig | null) => void;
}

export function useModuleState(initialModuleSlots: ModuleSlots): ModuleStateResult {
  const [moduleSlots, setModuleSlotsState] = useState<ModuleSlots>(initialModuleSlots);

  const setModuleSlot = (index: number, config: ModuleConfig | null) => {
    setAtIndex(setModuleSlotsState, index, config);
  };

  return { moduleSlots, setModuleSlotsState, setModuleSlot };
}
