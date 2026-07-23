import type { StateCreator } from 'zustand';
import {
  DEFAULT_LOADOUT,
  EQUIPMENT_BOTTOM_SLOTS,
  EQUIPMENT_TOP_SLOTS,
  getMaxPerfectline,
} from '../equipment/equipmentData';
import { STATIC_AUTOSAVE_DEFAULTS } from '../plan/planDefaults';
import type {
  EquipmentItem,
  EquipmentSlotId,
  EquippedItems,
  EvolutionStatId,
  LegendaryAffixSelection,
  SlotEnchants,
  SlotEvolutionStats,
  SlotLegendaryAffix,
  SlotLegendaryAffixGroups,
  SlotRefineLevels,
} from '../types';
import { getAutoSaveOnMount } from './autoSaveOnMount';
import type { BuildStore } from './types';

export interface EquipmentSlice {
  equipped: EquippedItems;
  refineLevels: SlotRefineLevels;
  perfectlines: SlotRefineLevels;
  evolutionStats: SlotEvolutionStats;
  legendaryAffixState: SlotLegendaryAffix;
  legendaryAffixGroupState: SlotLegendaryAffixGroups;
  slotEnchants: SlotEnchants;
  // 生の全体セッター。プラン読込/リセット専用。
  setEquipped: (equipped: EquippedItems) => void;
  setRefineLevels: (levels: SlotRefineLevels) => void;
  setPerfectlines: (perfectlines: SlotRefineLevels) => void;
  setEvolutionStatsState: (stats: SlotEvolutionStats) => void;
  setLegendaryAffixState: (state: SlotLegendaryAffix) => void;
  setLegendaryAffixGroupState: (state: SlotLegendaryAffixGroups) => void;
  setSlotEnchants: (enchants: SlotEnchants) => void;
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
  setLegendaryAffixGroup: (
    slot: EquipmentSlotId,
    groupIndex: number,
    selection: LegendaryAffixSelection | undefined,
  ) => void;
  setSlotEnchant: (slot: EquipmentSlotId, itemId: number | undefined) => void;
  // 転職時に武器(常に)・メインステータス変更時は上下半身装備も外し、進化ステータス選択をリセットする。
  resetEquipmentForProfessionChange: (mainStatChanged: boolean) => void;
}

export const createEquipmentSlice: StateCreator<BuildStore, [], [], EquipmentSlice> = (set) => {
  const autoSaveOnMount = getAutoSaveOnMount().state;

  return {
    equipped: autoSaveOnMount?.equipped ?? DEFAULT_LOADOUT,
    refineLevels: autoSaveOnMount?.refineLevels ?? STATIC_AUTOSAVE_DEFAULTS.refineLevels,
    perfectlines: autoSaveOnMount?.perfectlines ?? STATIC_AUTOSAVE_DEFAULTS.perfectlines,
    evolutionStats: autoSaveOnMount?.evolutionStats ?? STATIC_AUTOSAVE_DEFAULTS.evolutionStats,
    legendaryAffixState:
      autoSaveOnMount?.legendaryAffixState ?? STATIC_AUTOSAVE_DEFAULTS.legendaryAffixState,
    legendaryAffixGroupState:
      autoSaveOnMount?.legendaryAffixGroupState ??
      STATIC_AUTOSAVE_DEFAULTS.legendaryAffixGroupState,
    slotEnchants: autoSaveOnMount?.slotEnchants ?? STATIC_AUTOSAVE_DEFAULTS.slotEnchants,

    setEquipped: (equipped) => set({ equipped }),
    setRefineLevels: (refineLevels) => set({ refineLevels }),
    setPerfectlines: (perfectlines) => set({ perfectlines }),
    setEvolutionStatsState: (evolutionStats) => set({ evolutionStats }),
    setLegendaryAffixState: (legendaryAffixState) => set({ legendaryAffixState }),
    setLegendaryAffixGroupState: (legendaryAffixGroupState) => set({ legendaryAffixGroupState }),
    setSlotEnchants: (slotEnchants) => set({ slotEnchants }),

    setRefineLevel: (slot, level) =>
      set((state) => ({ refineLevels: { ...state.refineLevels, [slot]: level } })),

    setPerfectline: (slot, value) =>
      set((state) => ({ perfectlines: { ...state.perfectlines, [slot]: value } })),

    setEvolutionStat: (slot, slotIndex, statId) =>
      set((state) => {
        const current = [...(state.evolutionStats[slot] ?? [])];
        current[slotIndex] = statId;
        return { evolutionStats: { ...state.evolutionStats, [slot]: current } };
      }),

    equip: (slot, equipmentItem) =>
      set((state) => {
        const nextLegendaryAffixState = { ...state.legendaryAffixState };
        delete nextLegendaryAffixState[slot];
        const nextLegendaryAffixGroupState = { ...state.legendaryAffixGroupState };
        delete nextLegendaryAffixGroupState[slot];
        return {
          equipped: { ...state.equipped, [slot]: equipmentItem },
          perfectlines: { ...state.perfectlines, [slot]: getMaxPerfectline(equipmentItem) },
          legendaryAffixState: nextLegendaryAffixState,
          legendaryAffixGroupState: nextLegendaryAffixGroupState,
        };
      }),

    setLegendaryAffix: (slot, selection) =>
      set((state) => ({
        legendaryAffixState: { ...state.legendaryAffixState, [slot]: selection },
      })),

    setLegendaryAffixGroup: (slot, groupIndex, selection) =>
      set((state) => {
        const current = [...(state.legendaryAffixGroupState[slot] ?? [])];
        current[groupIndex] = selection;
        return {
          legendaryAffixGroupState: { ...state.legendaryAffixGroupState, [slot]: current },
        };
      }),

    unequip: (slot) =>
      set((state) => {
        const nextEquipped = { ...state.equipped };
        delete nextEquipped[slot];
        const nextEvolutionStats = { ...state.evolutionStats };
        delete nextEvolutionStats[slot];
        const nextLegendaryAffixState = { ...state.legendaryAffixState };
        delete nextLegendaryAffixState[slot];
        const nextLegendaryAffixGroupState = { ...state.legendaryAffixGroupState };
        delete nextLegendaryAffixGroupState[slot];
        const nextSlotEnchants = { ...state.slotEnchants };
        delete nextSlotEnchants[slot];
        return {
          equipped: nextEquipped,
          evolutionStats: nextEvolutionStats,
          legendaryAffixState: nextLegendaryAffixState,
          legendaryAffixGroupState: nextLegendaryAffixGroupState,
          slotEnchants: nextSlotEnchants,
        };
      }),

    setSlotEnchant: (slot, itemId) =>
      set((state) => ({ slotEnchants: { ...state.slotEnchants, [slot]: itemId } })),

    resetEquipmentForProfessionChange: (mainStatChanged) =>
      set((state) => {
        const unequippedSlots: EquipmentSlotId[] = mainStatChanged
          ? ['weapon', ...EQUIPMENT_TOP_SLOTS, ...EQUIPMENT_BOTTOM_SLOTS]
          : ['weapon'];

        const nextEquipped = { ...state.equipped };
        const nextLegendaryAffixState = { ...state.legendaryAffixState };
        const nextLegendaryAffixGroupState = { ...state.legendaryAffixGroupState };
        const nextSlotEnchants = { ...state.slotEnchants };
        for (const slot of unequippedSlots) {
          delete nextEquipped[slot];
          delete nextLegendaryAffixState[slot];
          delete nextLegendaryAffixGroupState[slot];
          delete nextSlotEnchants[slot];
        }

        return {
          equipped: nextEquipped,
          evolutionStats: {},
          legendaryAffixState: nextLegendaryAffixState,
          legendaryAffixGroupState: nextLegendaryAffixGroupState,
          slotEnchants: nextSlotEnchants,
        };
      }),
  };
};
