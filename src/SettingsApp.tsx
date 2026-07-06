import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isTauri } from './platform';

interface SettingsAppProps {
  onClose?: () => void;
}

function SettingsApp({ onClose }: SettingsAppProps) {
  const { t, i18n } = useTranslation();
  const [pendingLang, setPendingLang] = useState(i18n.language);
  const isDirty = pendingLang !== i18n.language;

  const close = async () => {
    if (isTauri) {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      await getCurrentWebviewWindow().hide();
    } else {
      onClose?.();
    }
  };

  const handleSave = async () => {
    localStorage.setItem('bpsr-language', pendingLang);
    await i18n.changeLanguage(pendingLang);
    if (isTauri) {
      const { emit } = await import('@tauri-apps/api/event');
      await emit('language-changed', pendingLang);
    }
  };

  return (
    <main>
      <h1>{t('settings.title')}</h1>
      <label>
        {t('settings.language')}
        <select value={pendingLang} onChange={(e) => setPendingLang(e.target.value)}>
          <option value="ja_JP">日本語</option>
          <option value="en_US">English</option>
        </select>
      </label>
      {isDirty && <button onClick={handleSave}>{t('settings.save')}</button>}
      <button onClick={close}>{t('settings.close')}</button>
    </main>
  );
}

export default SettingsApp;
