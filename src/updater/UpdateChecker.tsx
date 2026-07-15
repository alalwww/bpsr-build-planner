import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Update } from '@tauri-apps/plugin-updater';
import ConfirmDialog from '../build-planner/components/ConfirmDialog';
import { checkForUpdate, installUpdate } from './updater';

// 起動時に一度だけ更新を確認し、更新があれば確認ダイアログを出す。
// 確認の失敗は静かに無視する(About ウィンドウから手動確認できる)。
function UpdateChecker() {
  const { t } = useTranslation();
  const [update, setUpdate] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkForUpdate()
      .then((found) => {
        if (!cancelled && found) setUpdate(found);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!update) return null;

  const install = () => {
    setInstalling(true);
    setFailed(false);
    installUpdate(update).catch(() => {
      setInstalling(false);
      setFailed(true);
    });
  };

  return (
    <ConfirmDialog
      title={t('updater.availableTitle')}
      message={
        failed ? t('updater.installError') : t('updater.availableMsg', { version: update.version })
      }
      confirmLabel={installing ? t('updater.installing') : t('updater.installNow')}
      confirmDisabled={installing}
      onConfirm={install}
      cancelLabel={t('updater.later')}
      onCancel={() => setUpdate(null)}
    />
  );
}

export default UpdateChecker;
