// tauri.conf.json で定義済みの常駐ウィンドウ(visible:false)を表示する。
// 閉じる操作は各ウィンドウ側の hide()(またはタイトルバー✕を main.rs で hide に変換)で行い、
// ウィンドウ自体は破棄しない。
export type ResidentWindowLabel = 'settings' | 'stats-detail' | 'ability-score';

export async function showResidentWindow(label: ResidentWindowLabel): Promise<void> {
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const window = await WebviewWindow.getByLabel(label);
  if (!window) return;
  await window.show();
  await window.setFocus();
}

/** About はモーダル(表示中は main を無効化)のため、Rust コマンド経由で表示する。 */
export async function showAboutWindow(): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('show_about_window');
}
