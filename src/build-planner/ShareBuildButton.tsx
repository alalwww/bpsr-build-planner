import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from './components/ConfirmDialog';
import { formatProfessionLabel } from './profession';
import { buildLineShareIntentUrl, buildXShareIntentUrl, shortenPlanCode } from './shortUrl';
import { computeStatsBundle } from './store/derivedSelectors';
import { useBuildStore } from './store/useBuildStore';
import { isTauri } from '../platform';

// シェア系のポップアップ(X/LINE)を、新しいタブではなく従来の共有ボタンに近い小さな
// ポップアップウィンドウとして開く。noopenerによりwindow.openerは渡さない。
function openSharePopup(url: string, name: string): void {
  const width = 550;
  const height = 470;
  const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
  const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
  window.open(
    url,
    name,
    `width=${width},height=${height},left=${left},top=${top},noopener,noreferrer,resizable,scrollbars`,
  );
}

async function copyToClipboard(text: string, onDone: (ok: boolean) => void): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    onDone(true);
  } catch {
    onDone(false);
  }
}

// アイコンボタン用のSVG共通ラッパー(viewBox/サイズ/塗りの定型部分をまとめる)。
function Icon({
  path,
  viewBox = '0 0 24 24',
  size = 16,
}: {
  path: string;
  viewBox?: string;
  size?: number;
}) {
  return (
    <svg viewBox={viewBox} width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

const SHARE_ICON_PATH =
  'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z';
// X(旧Twitter)公式ロゴ(viewBox 0 0 1200 1227)。
const X_ICON_PATH =
  'M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z';
// LINEの正式ロゴではなく汎用チャットバブル(LINEグリーンでホバー強調して代用)。
const LINE_ICON_PATH = 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z';
const COPY_ICON_PATH =
  'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z';

interface ShareBuildButtonProps {
  /** ダイアログの開閉。エクスポートダイアログとの相互切り替えのため、開閉状態は
   * 呼び出し元(PlanManager)で管理する制御コンポーネントにしている。 */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 「エクスポートへ切替」クリック時に呼ぶ(このダイアログを閉じた後、呼び出し元が
   * エクスポートダイアログを開く)。 */
  onSwitchToExport: () => void;
}

// プラン保存等と挙動を揃えるため、中央固定モーダル(ConfirmDialog)で共有リンクの作成・
// コピー・X/LINEでの共有まで到達できるようにする(docs/SHORT_URL.md参照)。Web版のみ対象。
function ShareBuildButton({ open, onOpenChange, onSwitchToExport }: ShareBuildButtonProps) {
  const { t, i18n } = useTranslation();
  const { t: tGame } = useTranslation('game-data');
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [textCopied, setTextCopied] = useState(false);

  if (isTauri) return null;

  const noteItems = t('buildPlanner.shortUrlRateLimitNote', {
    returnObjects: true,
    defaultValue: [],
  }) as string[];

  const handleOpen = () => {
    setShortUrl(null);
    setError(false);
    setUrlCopied(false);
    setTextCopied(false);
    onOpenChange(true);
  };

  const handleSwitchToExport = () => {
    onOpenChange(false);
    onSwitchToExport();
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(false);
    try {
      const planCode = useBuildStore.getState().exportPlanCode();
      setShortUrl(await shortenPlanCode(planCode));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = () => {
    if (!shortUrl) return;
    void copyToClipboard(shortUrl, setUrlCopied);
  };

  // クラス名(型名)・能力スコアはクリック時点(=共有時点)の最新値を都度読む
  // (モーダルを開いている間の状態変化に追従させる必要はないため)。ハッシュタグは
  // X上での発見性向上を狙ったXの文化に沿ったものであり、LINE/クリップボードへコピーする
  // 文面には付けない(付けても意味を持たないため)。
  const buildShareMessage = (url: string) => {
    const state = useBuildStore.getState();
    const { abilityScore } = computeStatsBundle(state);
    // i18n.language は 'ja_JP'/'en_US' (アンダースコア区切り) だが、toLocaleString は
    // BCP 47 (ハイフン区切り) しか受け付けないため変換する。
    return t('buildPlanner.shareText', {
      className: formatProfessionLabel(state.professionKey, state.professionTypeKey, tGame),
      score: Math.round(abilityScore.total).toLocaleString(i18n.language.replace('_', '-')),
      url,
    });
  };

  const buildXShareText = (url: string) =>
    `${buildShareMessage(url)}\n\n${t('buildPlanner.shareXHashtags', { defaultValue: '' })}`;

  const handleShareX = () => {
    if (!shortUrl) return;
    openSharePopup(buildXShareIntentUrl(buildXShareText(shortUrl)), 'share-x');
  };

  const handleShareLine = () => {
    if (!shortUrl) return;
    openSharePopup(buildLineShareIntentUrl(buildShareMessage(shortUrl)), 'share-line');
  };

  const handleCopyText = () => {
    if (!shortUrl) return;
    void copyToClipboard(buildShareMessage(shortUrl), setTextCopied);
  };

  return (
    <>
      <button
        type="button"
        className="build-planner__nav-lang"
        onClick={handleOpen}
        title={t('buildPlanner.shareBuild', { defaultValue: '共有' })}
      >
        <Icon path={SHARE_ICON_PATH} size={18} />
      </button>
      {open && (
        <ConfirmDialog
          title={t('buildPlanner.shareBuild', { defaultValue: '共有' })}
          confirmLabel={t('buildPlanner.close', { defaultValue: '閉じる' })}
          onConfirm={() => onOpenChange(false)}
          cancelLabel={t('buildPlanner.switchToExport', { defaultValue: 'エクスポートへ切替' })}
          onCancel={handleSwitchToExport}
        >
          <button
            type="button"
            className="confirm-dialog__btn confirm-dialog__btn--cancel"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading
              ? t('buildPlanner.generatingShortUrl', { defaultValue: '作成中…' })
              : t('buildPlanner.generateShortUrl', { defaultValue: '共有リンクを作成' })}
          </button>
          <ul className="share-dialog__notes">
            {noteItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          {/* URL単体のコピー(貼り付け先を選ばない、最小限の共有) */}
          <div className="share-dialog__url-row">
            <input
              className={`confirm-dialog__input confirm-dialog__input--inline${
                shortUrl ? '' : ' share-dialog__input--muted'
              }`}
              readOnly
              value={shortUrl ?? ''}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              className="confirm-dialog__btn confirm-dialog__btn--cancel"
              onClick={handleCopyUrl}
              disabled={!shortUrl}
            >
              {urlCopied
                ? t('buildPlanner.copied', { defaultValue: 'コピーしました' })
                : t('buildPlanner.shortUrlCopy', { defaultValue: 'コピー' })}
            </button>
          </div>

          {/* クラス名・能力スコア等を含む文面での共有/コピー */}
          <div className="share-dialog__icons">
            <button
              type="button"
              className="share-dialog__icon-btn share-dialog__icon-btn--x"
              onClick={handleShareX}
              disabled={!shortUrl}
              title={t('buildPlanner.shareOnX', { defaultValue: 'Xで共有' })}
            >
              <Icon path={X_ICON_PATH} viewBox="0 0 1200 1227" />
            </button>
            <button
              type="button"
              className="share-dialog__icon-btn share-dialog__icon-btn--line"
              onClick={handleShareLine}
              disabled={!shortUrl}
              title={t('buildPlanner.shareOnLine', { defaultValue: 'LINEで共有' })}
            >
              <Icon path={LINE_ICON_PATH} size={18} />
            </button>
            <button
              type="button"
              className="share-dialog__icon-btn"
              onClick={handleCopyText}
              disabled={!shortUrl}
              title={t('buildPlanner.shareCopyText', { defaultValue: '本文をコピー' })}
            >
              {textCopied ? '✓' : <Icon path={COPY_ICON_PATH} />}
            </button>
          </div>

          {/* エラー有無で高さが変わりダイアログがガタつくのを防ぐため、非表示時も
              visibility:hiddenで領域だけ確保しておく(display:noneにしない)。 */}
          <p
            className={`confirm-dialog__error share-dialog__error${error ? '' : ' share-dialog__error--hidden'}`}
          >
            {t('buildPlanner.shortUrlErrorMsg', {
              defaultValue: '短縮URLの発行に失敗しました。しばらくしてからもう一度お試しください。',
            })}
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}

export default ShareBuildButton;
