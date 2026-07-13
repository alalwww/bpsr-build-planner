import i18n from '../i18n';
import { isTauri } from './index';

// Tauriでは main / settings が別webviewのため、片方での言語変更を
// このイベントでもう片方の i18next インスタンスへ伝搬する。
const LANGUAGE_CHANGED_EVENT = 'language-changed';

/** 言語を変更して永続化する。Tauriでは他ウィンドウへも伝搬する。 */
export function applyLanguage(lang: string): void {
  localStorage.setItem('bpsr-language', lang);
  void i18n.changeLanguage(lang);
  if (isTauri) {
    void (async () => {
      const { emit } = await import('@tauri-apps/api/event');
      await emit(LANGUAGE_CHANGED_EVENT, lang);
    })();
  }
}

/** 他ウィンドウ発の言語変更を受信して自ウィンドウへ反映する。各エントリポイントで一度だけ呼ぶ。 */
export function initLanguageSync(): void {
  if (!isTauri) return;
  void (async () => {
    const { listen } = await import('@tauri-apps/api/event');
    await listen<string>(LANGUAGE_CHANGED_EVENT, (event) => {
      // emit は発信元ウィンドウにも配送されるため、適用済みなら何もしない
      if (event.payload !== i18n.language) {
        void i18n.changeLanguage(event.payload);
      }
    });
  })();
}
