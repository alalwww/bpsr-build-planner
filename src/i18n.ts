import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUsGameData from './locales/en_US/game-data.json';
import enUsUi from './locales/en_US/bpsr-bp-ui.json';
import jaJpGameData from './locales/ja_JP/game-data.json';
import jaJpUi from './locales/ja_JP/bpsr-bp-ui.json';

const savedLang = localStorage.getItem('bpsr-language') ?? 'ja_JP';

void i18n.use(initReactI18next).init({
  resources: {
    ja_JP: { translation: jaJpUi, 'game-data': jaJpGameData },
    en_US: { translation: enUsUi, 'game-data': enUsGameData },
  },
  lng: savedLang,
  fallbackLng: 'ja_JP',
  interpolation: { escapeValue: false },
});

export default i18n;
