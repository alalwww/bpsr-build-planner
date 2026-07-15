import type { Update } from '@tauri-apps/plugin-updater';
import { isTauri } from '../platform';

/** 更新を確認する。更新がなければ null。確認自体の失敗(オフライン、
 * リリース直後で latest.json が未添付等)は例外を投げる。 */
export async function checkForUpdate(): Promise<Update | null> {
  if (!isTauri) return null;
  const { check } = await import('@tauri-apps/plugin-updater');
  return await check();
}

/** 更新をダウンロード・インストールしてアプリを再起動する。 */
export async function installUpdate(update: Update): Promise<void> {
  await update.downloadAndInstall();
  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}
