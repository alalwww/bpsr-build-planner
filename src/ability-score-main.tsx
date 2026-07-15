import React from 'react';
import ReactDOM from 'react-dom/client';
import AbilityScoreApp from './build-planner/character/AbilityScoreApp';
import './i18n';
import { initLanguageSync } from './platform/languageSync';
import { initStoreSyncReceiver } from './platform/storeSync';

initLanguageSync();
initStoreSyncReceiver();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AbilityScoreApp />
  </React.StrictMode>,
);
