import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './about.css';
import type { Update } from '@tauri-apps/plugin-updater';
import { checkForUpdate, installUpdate } from '../updater/updater';
import AboutPanel from './AboutPanel';
import { latestChangelogVersion } from './changelogData';
import { markChangelogSeen } from './changelogStorage';

type UpdateStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'latest' }
  | { kind: 'available'; update: Update }
  | { kind: 'installing' }
  | { kind: 'error' };

// クライアント版限定の About ウィンドウ(about.html)。
// AboutPanel(アプリ情報+変更履歴)に手動更新確認UIを加えて表示する。
function AboutApp() {
  const { t } = useTranslation();
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ kind: 'idle' });

  const checkUpdate = () => {
    setUpdateStatus({ kind: 'checking' });
    checkForUpdate()
      .then((update) =>
        setUpdateStatus(update ? { kind: 'available', update } : { kind: 'latest' }),
      )
      .catch(() => setUpdateStatus({ kind: 'error' }));
  };

  const install = (update: Update) => {
    setUpdateStatus({ kind: 'installing' });
    installUpdate(update).catch(() => setUpdateStatus({ kind: 'error' }));
  };

  const updateStatusText = {
    idle: '',
    checking: t('updater.checking'),
    latest: t('updater.latest'),
    available:
      updateStatus.kind === 'available'
        ? t('updater.available', { version: updateStatus.update.version })
        : '',
    installing: t('updater.installing'),
    error: t('updater.checkError'),
  }[updateStatus.kind];

  useEffect(() => {
    if (latestChangelogVersion) markChangelogSeen(latestChangelogVersion);
  }, []);

  // close() は CloseRequested を発火させるため、タイトルバー✕と同じく
  // main.rs 側のハンドラで hide + main の再有効化が行われる
  const close = () => {
    void (async () => {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      await getCurrentWebviewWindow().close();
    })();
  };

  const updateArea = (
    <>
      {updateStatus.kind === 'available' ? (
        <button type="button" onClick={() => install(updateStatus.update)}>
          {t('updater.installNow')}
        </button>
      ) : (
        <button
          type="button"
          onClick={checkUpdate}
          disabled={updateStatus.kind === 'checking' || updateStatus.kind === 'installing'}
        >
          {t('updater.checkNow')}
        </button>
      )}
      {updateStatusText && <span className="about-panel__update-status">{updateStatusText}</span>}
    </>
  );

  return (
    <div className="about-app">
      <AboutPanel updateArea={updateArea} onOk={close} />
    </div>
  );
}

export default AboutApp;
