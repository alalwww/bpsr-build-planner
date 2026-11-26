import type { NamedPreset } from '../components/preset/presetStorage';
import type { ModuleConfig, ModuleHole, ModuleSlots } from '../types';

// モジュールプリセット: ビルドプラン/自動保存/共有コードとは独立したローカル専用の保存機能。
// buildAutoSaveState()/applyPlanState()/planCode.ts のいずれにも含めないこと。

export interface ModulePreset extends NamedPreset {
  moduleSlots: ModuleSlots;
}

export const MAX_MODULE_PRESETS = 20;
export const MAX_MODULE_PRESET_NAME_LENGTH = 100;

export const MODULE_PRESETS_STORAGE_KEY = 'bpsr-module-presets-v1';

function moduleHoleEqual(a: ModuleHole, b: ModuleHole): boolean {
  return a.effectId === b.effectId && a.linkCount === b.linkCount;
}

function moduleConfigEqual(a: ModuleConfig | null, b: ModuleConfig | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a.modId !== b.modId || a.holes.length !== b.holes.length) return false;
  return a.holes.every((hole, i) => moduleHoleEqual(hole, b.holes[i]));
}

// プリセット保存時の内容と現在の選択状態が一致するかの比較(保存ボタンの活性制御・
// プリセット切り替え時の無確認スイッチ可否判定に使う)。
export function moduleSlotsEqual(a: ModuleSlots, b: ModuleSlots): boolean {
  if (a.length !== b.length) return false;
  return a.every((slot, i) => moduleConfigEqual(slot, b[i]));
}
