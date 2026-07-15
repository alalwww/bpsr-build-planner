import React from 'react';
import ReactDOM from 'react-dom/client';
import StatsDetailApp from './build-planner/character/StatsDetailApp';
import './i18n';
import { initLanguageSync } from './platform/languageSync';
import { initStoreSyncReceiver } from './platform/storeSync';

initLanguageSync();
initStoreSyncReceiver();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <StatsDetailApp />
  </React.StrictMode>,
);
