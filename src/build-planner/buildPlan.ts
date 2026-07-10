import type { ProfessionKey, ProfessionTypeKey } from './profession';
import type {
  EquipmentSlotId,
  EquippedItems,
  EvolutionStatId,
  LegendaryAffixSelection,
  ModuleSlots,
  SlotEnchants,
  SlotRefineLevels,
} from './types';
import type { PhantomFactorSlotValue } from './phantom/phantomData';

export interface BuildPlanData {
  id: string;
  name: string;
  professionKey: ProfessionKey;
  professionTypeKey: ProfessionTypeKey;
  equipped: EquippedItems;
  refineLevels: SlotRefineLevels;
  perfectlines: SlotRefineLevels;
  evolutionStats: Partial<Record<EquipmentSlotId, Array<EvolutionStatId | undefined>>>;
  legendaryAffixState: Partial<Record<EquipmentSlotId, LegendaryAffixSelection | undefined>>;
  masteryEquipped: boolean[];
  masteryLevels: number[];
  masteryRanks: number[];
  fixedLevels: number[];
  fixedRanks: number[];
  battleImagines: (number | null)[];
  imagineRanks: number[];
  talentR1EnabledIds: number[];
  talentR2EnabledIds: number[];
  slotEnchants: SlotEnchants;
  moduleSlots: ModuleSlots;
  adventurerLevel?: number;
  phantomEnabled?: boolean;
  phantomLevel?: number;
  phantomTemplateId?: number | null;
  phantomBondPoints?: number;
  phantomNodeSelections?: Record<number, number>;
  phantomFactorSlots?: Record<number, PhantomFactorSlotValue | null>;
}

// 現在の編集状態（自動保存用）。id は不要だが名前欄も保存対象
export type AutoSaveState = Omit<BuildPlanData, 'id'>;

// v2: 現バージョン。下位互換性のない変更時はキー名のバージョンを上げ旧データを無視する
// (v1→v2: battleImaginaries/imaginaryRanksフィールドをbattleImagines/imagineRanksへ改名)
const STORAGE_KEY_V2 = 'bpsr-build-plans-v2';
const LEGACY_STORAGE_KEY = 'bpsr-build-plans';
const AUTO_SAVE_KEY = 'bpsr-autosave-v2';

export function loadBuildPlans(): BuildPlanData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V2);
    if (raw != null) return JSON.parse(raw) as BuildPlanData[];
    // v2キーが未存在の場合は旧キーからマイグレーション
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw != null) {
      const plans = JSON.parse(legacyRaw) as BuildPlanData[];
      localStorage.setItem(STORAGE_KEY_V2, legacyRaw);
      return plans;
    }
    return [];
  } catch {
    return [];
  }
}

export function persistBuildPlans(plans: BuildPlanData[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(plans));
  } catch {
    // quota exceeded or storage unavailable
  }
}

export function loadAutoSave(): AutoSaveState | null {
  try {
    const raw = localStorage.getItem(AUTO_SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AutoSaveState;
  } catch {
    return null;
  }
}

export function persistAutoSave(state: AutoSaveState): void {
  try {
    localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(state));
  } catch {
    // quota exceeded or storage unavailable
  }
}
