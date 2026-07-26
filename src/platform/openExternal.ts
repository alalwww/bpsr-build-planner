import { isTauri } from './index';

/** クライアント版は既定ブラウザで、Web版は新規タブでURLを開く。 */
export function openExternal(url: string): void {
  if (isTauri) {
    void (async () => {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
    })();
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
