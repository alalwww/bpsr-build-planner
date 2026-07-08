import { DEFAULT_LOADOUT } from './equipment/equipmentData';
import type { ProfessionKey } from './profession';
import { PROFESSIONS } from './profession';
import { getClassData, initTalentR1Ids, initTalentR2Ids } from './stats/gameData';
import type { AutoSaveState } from './buildPlan';
import type { SlotRefineLevels } from './types';

// ビルドプランの各フィールドのデフォルト値をここに一元化する。
// useBuildState.ts の useState初期値・resetPlan・applyPlanState のフォールバックが
// すべてここを参照することで、デフォルト値が複数箇所に手書きで重複するのを防ぐ。

export const DEFAULT_REFINE_LEVELS: SlotRefineLevels = {
  weapon: 30,
  head: 30,
  chest: 30,
  arms: 30,
  legs: 30,
  earring: 30,
  necklace: 30,
  ring: 30,
  ringLeft: 30,
  ringRight: 30,
  belt: 30,
};

export const DEFAULT_PERFECTLINES: SlotRefineLevels = {
  weapon: 100,
  head: 100,
  chest: 100,
  arms: 100,
  legs: 100,
  earring: 100,
  necklace: 100,
  ring: 100,
  ringLeft: 100,
  ringRight: 100,
  belt: 100,
};

// プロフェッション非依存の静的デフォルト値。
export const STATIC_AUTOSAVE_DEFAULTS = {
  refineLevels: DEFAULT_REFINE_LEVELS,
  perfectlines: DEFAULT_PERFECTLINES,
  evolutionStats: {},
  legendaryAffixState: {},
  slotEnchants: {},
  fixedLevels: [30, 30, 30],
  fixedRanks: [6, 6, 6],
  battleImaginaries: [null, null],
  imaginaryRanks: [5, 5],
  moduleSlots: [null, null, null, null, null],
  adventurerLevel: 60,
  phantomEnabled: true,
  phantomLevel: 100,
  phantomTemplateId: null,
  phantomBondPoints: 35,
  phantomNodeSelections: {},
  phantomFactorSlots: {},
} satisfies Partial<AutoSaveState>;

// プロフェッション依存のデフォルト値(マスタリースキル配列長・アビリティ初期解放ノード)。
export function getDefaultProfessionState(professionKey: ProfessionKey) {
  const professionId = PROFESSIONS[professionKey].professionId;
  const skillCount = getClassData(professionId)?.normalSkill.length ?? 0;
  return {
    professionKey,
    professionTypeKey: 'type1' as const,
    masteryEquipped: Array(skillCount).fill(false) as boolean[],
    masteryLevels: Array(skillCount).fill(30) as number[],
    masteryRanks: Array(skillCount).fill(6) as number[],
    talentR1EnabledIds: [...initTalentR1Ids(professionId)],
    talentR2EnabledIds: [...initTalentR2Ids(professionId, 0)],
  };
}

// 全フィールドを埋めたAutoSaveStateを返す(新規useState初期値・resetPlanで使用)。
// Required<> にすることで、呼び出し側は各フィールドが常に値を持つことを型上も保証できる
// (BuildPlanDataの一部フィールドは旧データ互換のためoptionalだが、ここでは常に埋まる)。
export function getDefaultAutoSaveState(professionKey: ProfessionKey): Required<AutoSaveState> {
  return {
    name: '',
    equipped: DEFAULT_LOADOUT,
    ...STATIC_AUTOSAVE_DEFAULTS,
    ...getDefaultProfessionState(professionKey),
  };
}
