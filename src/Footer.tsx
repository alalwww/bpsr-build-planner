import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatBuildTime } from './buildInfo';
import AboutDialog from './about/AboutDialog';
import { latestChangelogVersion } from './about/changelogData';
import { hasUnreadChangelog, markChangelogSeen } from './about/changelogStorage';
import './Footer.css';

function Footer() {
  const { t } = useTranslation();
  const [showChangelog, setShowChangelog] = useState(false);
  const [unread, setUnread] = useState(() => hasUnreadChangelog(latestChangelogVersion));

  const openChangelog = () => {
    setShowChangelog(true);
    if (latestChangelogVersion) markChangelogSeen(latestChangelogVersion);
    setUnread(false);
  };

  return (
    <>
      <footer className="app-footer">
        <div className="app-footer-notice">
          <p>{t('footer.copyright')}</p>
          <p>{t('footer.disclaimer')}</p>
        </div>
        <button type="button" className="app-footer-build" onClick={openChangelog}>
          {__APP_VERSION__} ({formatBuildTime(__BUILD_TIME__)})
          {unread && (
            <span className="app-footer-build__dot" aria-label={t('changelog.unreadBadge')} />
          )}
        </button>
      </footer>
      {showChangelog && <AboutDialog onClose={() => setShowChangelog(false)} />}
    </>
  );
}

export default Footer;
