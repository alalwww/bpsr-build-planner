import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './settings.css';
import { isTauri } from './platform';
import { applyLanguage } from './platform/languageSync';
import { SUPPORTED_LANGUAGES } from './platform/languages';

interface SettingsAppProps {
  onClose?: () => void;
}

function SettingsApp({ onClose }: SettingsAppProps) {
  const { t, i18n } = useTranslation();
  const [pendingLang, setPendingLang] = useState(i18n.language);
  const isDirty = pendingLang !== i18n.language;

  // 他ウィンドウ(mainの言語メニュー等)で言語が変わったら未保存の選択をリセットする
  useEffect(() => {
    setPendingLang(i18n.language);
  }, [i18n.language]);

  const close = async () => {
    if (isTauri) {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      await getCurrentWebviewWindow().hide();
    } else {
      onClose?.();
    }
  };

  const handleSave = () => {
    applyLanguage(pendingLang);
  };

  return (
    <div className="settings-app">
      <h1>{t('settings.title')}</h1>
      <label>
        {t('settings.language')}
        <select value={pendingLang} onChange={(e) => setPendingLang(e.target.value)}>
          {SUPPORTED_LANGUAGES.map(({ code, label }) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {isDirty && <button onClick={handleSave}>{t('settings.save')}</button>}
      <button onClick={close}>{t('settings.close')}</button>
    </div>
  );
}

export default SettingsApp;
