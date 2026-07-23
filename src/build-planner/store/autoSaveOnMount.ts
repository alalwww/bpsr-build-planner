import type { LoadAutoSaveResult } from '../plan/buildPlan';
import { loadAutoSave } from '../plan/buildPlan';

// ストアの初期状態はモジュール読み込み時に一度だけ localStorage から復元する
// (旧 useState(loadAutoSave) の lazy initializer と同じく、実行は1回のみ)。
let cached: LoadAutoSaveResult | undefined;

export function getAutoSaveOnMount(): LoadAutoSaveResult {
  if (cached === undefined) cached = loadAutoSave();
  return cached;
}

// テスト用: モジュールスコープのキャッシュをリセットする。
export function resetAutoSaveOnMountCache(): void {
  cached = undefined;
}
