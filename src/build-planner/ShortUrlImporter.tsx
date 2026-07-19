import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from './components/ConfirmDialog';
import { formatProfessionLabel } from './profession';
import { extractShortCodeFromHash, resolveShortCode } from './shortUrl';
import { useBuildStore } from './store/useBuildStore';

// 起動時、URLフラグメントが短縮URL形式(#/{code})であればAPIから解決してインポートする。
// Web版のみ対象(docs/SHORT_URL.md参照、App.tsx側で!isTauriの時のみマウントする)。
// 成功/失敗いずれの場合もハッシュは消し、リロード時の再解決・再インポートを防ぐ。
function ShortUrlImporter() {
  const { t } = useTranslation();
  const { t: tGame } = useTranslation('game-data');
  const onImportPlanCode = useBuildStore((s) => s.importPlanCode);
  const [error, setError] = useState(false);

  useEffect(() => {
    const code = extractShortCodeFromHash(window.location.hash);
    if (!code) return;

    let cancelled = false;
    resolveShortCode(code)
      .then((planCode) => {
        if (cancelled) return;
        if (onImportPlanCode(planCode) === 'failed') {
          setError(true);
          return;
        }
        // 短縮URL由来のplanCodeはプラン名を保存していないため常に空になる(docs/SHORT_URL.md参照)。
        // 空のままだと自動保存フィールドとして書き戻り、編集中だった名前を消してしまうため、
        // クラス名(型名)をデフォルト名として補う。
        const state = useBuildStore.getState();
        if (!state.planName.trim()) {
          state.setPlanName(
            formatProfessionLabel(state.professionKey, state.professionTypeKey, tGame),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!error) return null;

  return (
    <ConfirmDialog
      message={t('buildPlanner.shortUrlImportErrorMsg', {
        defaultValue:
          '共有されたビルドを読み込めませんでした。リンクが無効か、期限切れの可能性があります。',
      })}
      confirmLabel={t('buildPlanner.confirmOk', { defaultValue: 'OK' })}
      onConfirm={() => setError(false)}
    />
  );
}

export default ShortUrlImporter;
