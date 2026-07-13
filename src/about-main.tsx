import React from 'react';
import ReactDOM from 'react-dom/client';
import AboutApp from './AboutApp';
import './i18n';
import { initLanguageSync } from './platform/languageSync';

initLanguageSync();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AboutApp />
  </React.StrictMode>,
);
