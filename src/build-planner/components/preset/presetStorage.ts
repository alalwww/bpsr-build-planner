// 名前付きプリセット(モジュールプリセット/映痕プリセット等)の共通保存処理。
// ビルドプラン/自動保存/共有コードとは独立したローカル専用の保存機能で、プリセットの種類ごとに
// 別の localStorage キーへ JSON 配列で保存する(新しいものが先頭)。

export interface NamedPreset {
  id: string;
  name: string;
}

// localStorage自体が使えない環境(プライベートブラウジング等)をキー不在と同様に扱う。
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function loadPresets<P extends NamedPreset>(storageKey: string): P[] {
  const raw = safeGetItem(storageKey);
  if (raw == null) return [];
  try {
    const parsed = JSON.parse(raw) as P[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistPresets<P extends NamedPreset>(storageKey: string, presets: P[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(presets));
  } catch {
    // quota exceeded or storage unavailable
  }
}

// 以下はプリセット一覧の更新(新しい配列を返す純関数)。保存は呼び出し側で persistPresets する。

// 新しいプリセットを先頭に追加する。
export function addPreset<P extends NamedPreset>(
  presets: P[],
  name: string,
  content: Omit<P, 'id' | 'name'>,
): { presets: P[]; added: P } {
  const added = { ...content, id: crypto.randomUUID(), name } as P;
  return { presets: [added, ...presets], added };
}

// 既存プリセットの名前と内容を上書きする。
export function overwritePreset<P extends NamedPreset>(
  presets: P[],
  id: string,
  name: string,
  content: Omit<P, 'id' | 'name'>,
): P[] {
  return presets.map((p) => (p.id === id ? ({ ...p, ...content, id, name } as P) : p));
}

export function renamePreset<P extends NamedPreset>(presets: P[], id: string, name: string): P[] {
  return presets.map((p) => (p.id === id ? { ...p, name } : p));
}

export function deletePreset<P extends NamedPreset>(presets: P[], id: string): P[] {
  return presets.filter((p) => p.id !== id);
}
