import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatBuildTime } from '../../buildInfo';
import AboutDialog from '../../about/AboutDialog';
import { latestChangelogVersion } from '../../about/changelogData';
import { hasUnreadChangelog, markChangelogSeen } from '../../about/changelogStorage';
import PrivacyPolicyDialog from '../../privacy/PrivacyPolicyDialog';

// スマホ幅では画面全体のフッター(Footer.tsx、.app-footer)をCSS側で隠し、代わりに
// キャラクターパネル最下部にこのフッターを表示する(バージョン→区切り線→
// プライバシーポリシー→コピーライト→免責文言の順で中央揃え・縦積み)。
function CharacterPanelFooter() {
  const { t } = useTranslation();
  const [showChangelog, setShowChangelog] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [unread, setUnread] = useState(() => hasUnreadChangelog(latestChangelogVersion));

  const openChangelog = () => {
    setShowChangelog(true);
    if (latestChangelogVersion) markChangelogSeen(latestChangelogVersion);
    setUnread(false);
  };

  return (
    <>
      <div className="character-panel__footer">
        <button type="button" className="character-panel__footer-build" onClick={openChangelog}>
          {__APP_VERSION__} ({formatBuildTime(__BUILD_TIME__)})
          {unread && (
            <span className="app-footer-build__dot" aria-label={t('changelog.unreadBadge')} />
          )}
        </button>
        <hr className="character-panel__footer-hr" />
        <button
          type="button"
          className="character-panel__footer-privacy-link"
          onClick={() => setShowPrivacyPolicy(true)}
        >
          {t('privacy.footerLink')}
        </button>
        <p className="character-panel__footer-copyright">{t('footer.copyright')}</p>
        <p className="character-panel__footer-disclaimer">{t('footer.disclaimer')}</p>
      </div>
      {showChangelog && <AboutDialog onClose={() => setShowChangelog(false)} />}
      {showPrivacyPolicy && <PrivacyPolicyDialog onClose={() => setShowPrivacyPolicy(false)} />}
    </>
  );
}

export default CharacterPanelFooter;
