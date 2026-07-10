import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ChangelogDialog from './changelog/ChangelogDialog';
import { latestChangelogVersion } from './changelog/changelogData';
import { hasUnreadChangelog, markChangelogSeen } from './changelog/changelogStorage';
import './Footer.css';

// ローカルタイムゾーンのオフセットを ISO 形式 (+09:00 など) に変換する
function formatTimezoneOffset(offsetMinutes: number): string {
  const sign = offsetMinutes <= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const minutes = String(abs % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

// __BUILD_TIME__ (UTC ISO文字列) を閲覧者のタイムゾーンの ISO 風表記に変換する
function formatBuildTime(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const offset = formatTimezoneOffset(date.getTimezoneOffset());
  return `${y}-${m}-${d} ${h}:${min}${offset}`;
}

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
      {showChangelog && <ChangelogDialog onClose={() => setShowChangelog(false)} />}
    </>
  );
}

export default Footer;
