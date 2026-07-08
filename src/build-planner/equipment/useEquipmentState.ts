import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import {
  DEFAULT_LOADOUT,
  EQUIPMENT_BOTTOM_SLOTS,
  EQUIPMENT_TOP_SLOTS,
  getMaxPerfectline,
} from './equipmentData';
import { STATIC_AUTOSAVE_DEFAULTS } from '../planDefaults';
import type {
  EquipmentItem,
  EquipmentSlotId,
  EquippedItems,
  EvolutionStatId,
  LegendaryAffixSelection,
  SlotEnchants,
  SlotEvolutionStats,
  SlotLegendaryAffix,
  SlotRefineLevels,
} from '../types';

export interface EquipmentStateResult {
  equipped: EquippedItems;
  // 生の全体セッター。プラン読込/リセット(useBuildState.ts側)専用。
  setEquipped: Dispatch<SetStateAction<EquippedItems>>;
  refineLevels: SlotRefineLevels;
  setRefineLevels: Dispatch<SetStateAction<SlotRefineLevels>>;
  perfectlines: SlotRefineLevels;
  setPerfectlines: Dispatch<SetStateAction<SlotRefineLevels>>;
  evolutionStats: SlotEvolutionStats;
  setEvolutionStatsState: Dispatch<SetStateAction<SlotEvolutionStats>>;
  legendaryAffixState: SlotLegendaryAffix;
  setLegendaryAffixState: Dispatch<SetStateAction<SlotLegendaryAffix>>;
  slotEnchants: SlotEnchants;
  setSlotEnchants: Dispatch<SetStateAction<SlotEnchants>>;
  equip: (slot: EquipmentSlotId, equipmentItem: EquipmentItem) => void;
  unequip: (slot: EquipmentSlotId) => void;
  setRefineLevel: (slot: EquipmentSlotId, level: number) => void;
  setPerfectline: (slot: EquipmentSlotId, value: number) => void;
  setEvolutionStat: (
    slot: EquipmentSlotId,
    slotIndex: number,
    statId: EvolutionStatId | undefined,
  ) => void;
  setLegendaryAffix: (
    slot: EquipmentSlotId,
    selection: LegendaryAffixSelection | undefined,
  ) => void;
  setSlotEnchant: (slot: EquipmentSlotId, itemId: number | undefined) => void;
  // 転職時に武器(常に)・メインステータス変更時は上下半身装備も外し、進化ステータス選択をリセットする。
  resetForProfessionChange: (mainStatChanged: boolean) => void;
}

export function useEquipmentState(initial: {
  equipped?: EquippedItems;
  refineLevels?: SlotRefineLevels;
  perfectlines?: SlotRefineLevels;
  evolutionStats?: SlotEvolutionStats;
  legendaryAffixState?: SlotLegendaryAffix;
  slotEnchants?: SlotEnchants;
}): EquipmentStateResult {
  const [equipped, setEquipped] = useState<EquippedItems>(
    () => initial.equipped ?? DEFAULT_LOADOUT,
  );
  const [refineLevels, setRefineLevels] = useState<SlotRefineLevels>(
    () => initial.refineLevels ?? STATIC_AUTOSAVE_DEFAULTS.refineLevels,
  );
  const [perfectlines, setPerfectlines] = useState<SlotRefineLevels>(
    () => initial.perfectlines ?? STATIC_AUTOSAVE_DEFAULTS.perfectlines,
  );
  const [evolutionStats, setEvolutionStatsState] = useState<SlotEvolutionStats>(
    () => initial.evolutionStats ?? STATIC_AUTOSAVE_DEFAULTS.evolutionStats,
  );
  const [legendaryAffixState, setLegendaryAffixState] = useState<SlotLegendaryAffix>(
    () => initial.legendaryAffixState ?? STATIC_AUTOSAVE_DEFAULTS.legendaryAffixState,
  );
  const [slotEnchants, setSlotEnchants] = useState<SlotEnchants>(
    () => initial.slotEnchants ?? STATIC_AUTOSAVE_DEFAULTS.slotEnchants,
  );

  const setRefineLevel = (slot: EquipmentSlotId, level: number) => {
    setRefineLevels((prev) => ({ ...prev, [slot]: level }));
  };

  const setPerfectline = (slot: EquipmentSlotId, value: number) => {
    setPerfectlines((prev) => ({ ...prev, [slot]: value }));
  };

  const setEvolutionStat = (
    slot: EquipmentSlotId,
    slotIndex: number,
    statId: EvolutionStatId | undefined,
  ) => {
    setEvolutionStatsState((prev) => {
      const current = [...(prev[slot] ?? [])];
      current[slotIndex] = statId;
      return { ...prev, [slot]: current };
    });
  };

  const equip = (slot: EquipmentSlotId, equipmentItem: EquipmentItem) => {
    setEquipped((prev) => ({ ...prev, [slot]: equipmentItem }));
    setPerfectlines((prev) => ({ ...prev, [slot]: getMaxPerfectline(equipmentItem) }));
    setLegendaryAffixState((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  };

  const setLegendaryAffix = (
    slot: EquipmentSlotId,
    selection: LegendaryAffixSelection | undefined,
  ) => {
    setLegendaryAffixState((prev) => ({ ...prev, [slot]: selection }));
  };

  const unequip = (slot: EquipmentSlotId) => {
    setEquipped((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setEvolutionStatsState((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setLegendaryAffixState((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setSlotEnchants((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  };

  const setSlotEnchant = (slot: EquipmentSlotId, itemId: number | undefined) =>
    setSlotEnchants((prev) => ({ ...prev, [slot]: itemId }));

  const resetForProfessionChange = (mainStatChanged: boolean) => {
    setEquipped((prev) => {
      const next = { ...prev };
      delete next.weapon;
      if (mainStatChanged) {
        for (const slot of [...EQUIPMENT_TOP_SLOTS, ...EQUIPMENT_BOTTOM_SLOTS]) {
          delete next[slot];
        }
      }
      return next;
    });
    setEvolutionStatsState({});
  };

  return {
    equipped,
    setEquipped,
    refineLevels,
    setRefineLevels,
    perfectlines,
    setPerfectlines,
    evolutionStats,
    setEvolutionStatsState,
    legendaryAffixState,
    setLegendaryAffixState,
    slotEnchants,
    setSlotEnchants,
    equip,
    unequip,
    setRefineLevel,
    setPerfectline,
    setEvolutionStat,
    setLegendaryAffix,
    setSlotEnchant,
    resetForProfessionChange,
  };
}
