import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUsGameData from './locales/en_US/game-data.json';
import enUsUi from './locales/en_US/bpsr-bp-ui.json';
import jaJpGameData from './locales/ja_JP/game-data.json';
import jaJpUi from './locales/ja_JP/bpsr-bp-ui.json';
import koKrGameData from './locales/ko_KR/game-data.json';
import koKrUi from './locales/ko_KR/bpsr-bp-ui.json';
import zhCnGameData from './locales/zh_CN/game-data.json';
import zhCnUi from './locales/zh_CN/bpsr-bp-ui.json';
import zhTwGameData from './locales/zh_TW/game-data.json';
import zhTwUi from './locales/zh_TW/bpsr-bp-ui.json';

const savedLang = localStorage.getItem('bpsr-language') ?? 'ja_JP';

void i18n.use(initReactI18next).init({
  resources: {
    en_US: { translation: enUsUi, 'game-data': enUsGameData },
    ja_JP: { translation: jaJpUi, 'game-data': jaJpGameData },
    ko_KR: { translation: koKrUi, 'game-data': koKrGameData },
    zh_CN: { translation: zhCnUi, 'game-data': zhCnGameData },
    zh_TW: { translation: zhTwUi, 'game-data': zhTwGameData },
  },
  lng: savedLang,
  fallbackLng: 'ja_JP',
  interpolation: { escapeValue: false },
});

export default i18n;
