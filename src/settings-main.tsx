import React from 'react';
import ReactDOM from 'react-dom/client';
import SettingsApp from './SettingsApp';
import './i18n';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <SettingsApp />
  </React.StrictMode>,
);
