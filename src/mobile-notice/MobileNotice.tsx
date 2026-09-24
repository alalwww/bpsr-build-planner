import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile, useIsPortrait } from '../build-planner/components/useMediaQuery';
import { dismissMobileNotice, isMobileNoticeDismissed } from './mobileNoticeStorage';
import './MobileNotice.css';

// スマートフォン幅で表示する、PC版サイトの利用を勧める常設バナー。
// 縦画面の場合のみ、横向きにすると操作しやすくなる旨のヒントも添える。
// 閉じるとlocalStorageに時刻を記録し、24時間は再表示しない(セッションをまたいで抑制する)。
function MobileNotice() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const isPortrait = useIsPortrait();
  const [dismissed, setDismissed] = useState(isMobileNoticeDismissed);

  if (!isMobile || dismissed) return null;

  const handleDismiss = () => {
    dismissMobileNotice();
    setDismissed(true);
  };

  return (
    <div className="mobile-notice" role="note">
      <div className="mobile-notice__body">
        <p className="mobile-notice__text">{t('mobileNotice.body')}</p>
        {isPortrait && <p className="mobile-notice__text">{t('mobileNotice.rotateHint')}</p>}
      </div>
      <button
        type="button"
        className="mobile-notice__close"
        onClick={handleDismiss}
        aria-label={t('mobileNotice.close')}
      >
        ✕
      </button>
    </div>
  );
}

export default MobileNotice;
