import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import type { AutoSaveState } from '../buildPlan';
import { STATIC_AUTOSAVE_DEFAULTS } from '../planDefaults';
import { initPhantomNodeSelections, type PhantomFactorSlotValue } from './phantomData';

export interface PhantomStateResult {
  phantomEnabled: boolean;
  setPhantomEnabled: Dispatch<SetStateAction<boolean>>;
  phantomLevel: number;
  setPhantomLevel: Dispatch<SetStateAction<number>>;
  phantomTemplateId: number | null;
  // インタラクティブ用: テンプレート変更時にnode/factor選択をリセットする副作用を持つ。
  setPhantomTemplateId: (id: number | null) => void;
  // 生セッター。プラン読込/リセット(useBuildState.ts側)専用(上記の副作用を発火させない)。
  setPhantomTemplateIdState: Dispatch<SetStateAction<number | null>>;
  phantomBondPoints: number;
  setPhantomBondPoints: Dispatch<SetStateAction<number>>;
  phantomNodeSelections: Record<number, number>;
  setPhantomNodeSelection: (sameGroupId: number, nodeId: number) => void;
  setPhantomNodeSelectionsState: Dispatch<SetStateAction<Record<number, number>>>;
  phantomFactorSlots: Record<number, PhantomFactorSlotValue | null>;
  setPhantomFactorSlot: (groupId: number, factor: PhantomFactorSlotValue | null) => void;
  setPhantomFactorSlotsState: Dispatch<
    SetStateAction<Record<number, PhantomFactorSlotValue | null>>
  >;
}

export function usePhantomState(autoSaveOnMount: AutoSaveState | null): PhantomStateResult {
  const [phantomEnabled, setPhantomEnabled] = useState<boolean>(
    () => autoSaveOnMount?.phantomEnabled ?? STATIC_AUTOSAVE_DEFAULTS.phantomEnabled,
  );
  const [phantomLevel, setPhantomLevel] = useState<number>(
    () => autoSaveOnMount?.phantomLevel ?? STATIC_AUTOSAVE_DEFAULTS.phantomLevel,
  );
  const [phantomTemplateId, setPhantomTemplateIdState] = useState<number | null>(
    () => autoSaveOnMount?.phantomTemplateId ?? STATIC_AUTOSAVE_DEFAULTS.phantomTemplateId,
  );
  const [phantomBondPoints, setPhantomBondPoints] = useState<number>(
    () => autoSaveOnMount?.phantomBondPoints ?? STATIC_AUTOSAVE_DEFAULTS.phantomBondPoints,
  );
  const [phantomNodeSelections, setPhantomNodeSelectionsState] = useState<Record<number, number>>(
    () => {
      if (autoSaveOnMount?.phantomNodeSelections) return autoSaveOnMount.phantomNodeSelections;
      const tid = autoSaveOnMount?.phantomTemplateId;
      return tid != null ? initPhantomNodeSelections(tid) : {};
    },
  );
  const [phantomFactorSlots, setPhantomFactorSlotsState] = useState<
    Record<number, PhantomFactorSlotValue | null>
  >(() => autoSaveOnMount?.phantomFactorSlots ?? STATIC_AUTOSAVE_DEFAULTS.phantomFactorSlots);

  const setPhantomTemplateId = (id: number | null) => {
    setPhantomTemplateIdState(id);
    setPhantomNodeSelectionsState(id != null ? initPhantomNodeSelections(id) : {});
    setPhantomFactorSlotsState({});
  };

  const setPhantomNodeSelection = (sameGroupId: number, nodeId: number) => {
    setPhantomNodeSelectionsState((prev) => ({ ...prev, [sameGroupId]: nodeId }));
  };

  const setPhantomFactorSlot = (groupId: number, factor: PhantomFactorSlotValue | null) => {
    setPhantomFactorSlotsState((prev) => ({ ...prev, [groupId]: factor }));
  };

  return {
    phantomEnabled,
    setPhantomEnabled,
    phantomLevel,
    setPhantomLevel,
    phantomTemplateId,
    setPhantomTemplateId,
    setPhantomTemplateIdState,
    phantomBondPoints,
    setPhantomBondPoints,
    phantomNodeSelections,
    setPhantomNodeSelection,
    setPhantomNodeSelectionsState,
    phantomFactorSlots,
    setPhantomFactorSlot,
    setPhantomFactorSlotsState,
  };
}
