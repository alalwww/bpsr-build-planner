import { useTranslation } from 'react-i18next';
import './Footer.css';

function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="app-footer">
      <div className="app-footer-notice">
        <p>{t('footer.copyright')}</p>
        <p>{t('footer.disclaimer')}</p>
      </div>
      <p className="app-footer-build">
        {__APP_VERSION__} ({__BUILD_TIME__.slice(0, 16).replace('T', ' ')} UTC)
      </p>
    </footer>
  );
}

export default Footer;
