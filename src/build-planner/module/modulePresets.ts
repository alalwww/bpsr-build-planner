import type { ModuleConfig, ModuleHole, ModuleSlots } from '../types';

// モジュールプリセット: ビルドプラン/自動保存/共有コードとは独立したローカル専用の保存機能。
// buildAutoSaveState()/applyPlanState()/planCode.ts のいずれにも含めないこと。

export interface ModulePreset {
  id: string;
  name: string;
  moduleSlots: ModuleSlots;
}

export const MAX_MODULE_PRESETS = 20;
export const MAX_MODULE_PRESET_NAME_LENGTH = 100;

const STORAGE_KEY = 'bpsr-module-presets-v1';

// localStorage自体が使えない環境(プライベートブラウジング等)をキー不在と同様に扱う。
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function loadModulePresets(): ModulePreset[] {
  const raw = safeGetItem(STORAGE_KEY);
  if (raw == null) return [];
  try {
    const parsed = JSON.parse(raw) as ModulePreset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistModulePresets(presets: ModulePreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // quota exceeded or storage unavailable
  }
}

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
