import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './about.css';
import appIconUrl from '../src-tauri/icons/32x32.png';
import { formatBuildTime } from './buildInfo';
import ChangelogList from './changelog/ChangelogList';
import { latestChangelogVersion } from './changelog/changelogData';
import { markChangelogSeen } from './changelog/changelogStorage';

const WEB_APP_URL = 'https://bpsr-bp.awairo.net/';
const GITHUB_URL = 'https://github.com/alalwww/bpsr-build-planner';

// クライアント版限定の About ウィンドウ(about.html)。
// アプリ情報と変更履歴を表示する。将来ここに手動アップデート確認を追加する予定。
function AboutApp() {
  const { t } = useTranslation();

  useEffect(() => {
    if (latestChangelogVersion) markChangelogSeen(latestChangelogVersion);
  }, []);

  const openExternal = (url: string) => {
    void (async () => {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
    })();
  };

  // close() は CloseRequested を発火させるため、タイトルバー✕と同じく
  // main.rs 側のハンドラで hide + main の再有効化が行われる
  const close = () => {
    void (async () => {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      await getCurrentWebviewWindow().close();
    })();
  };

  return (
    <div className="about-app">
      <header className="about-app__header">
        <img src={appIconUrl} alt="BPSR Build Planner" className="about-app__logo" />
        <h1>BPSR Build Planner</h1>
        <div className="about-app__copyright">{t('footer.copyright')}</div>
        <dl>
          <div>
            <dt>Version</dt>
            <dd>
              {__APP_VERSION__} ({formatBuildTime(__BUILD_TIME__)})
            </dd>
          </div>
          <div>
            <dt>Author</dt>
            <dd>alalwww</dd>
          </div>
          <div>
            <dt>License</dt>
            <dd>MIT</dd>
          </div>
        </dl>
        <p className="about-app__disclaimer">{t('footer.disclaimer')}</p>
        <div className="about-app__links">
          <div>
            <button type="button" onClick={() => openExternal(WEB_APP_URL)}>
              {t('about.webApp')}
            </button>
            <button type="button" onClick={() => openExternal(GITHUB_URL)}>
              {t('about.github')}
            </button>
          </div>
          <div>
            <button type="button" className="about-app__ok" onClick={close}>
              {t('about.ok')}
            </button>
          </div>
        </div>
      </header>
      <h2 className="about-app__section-title">{t('changelog.title')}</h2>
      <div className="about-app__changelog">
        <ChangelogList />
      </div>
    </div>
  );
}

export default AboutApp;
