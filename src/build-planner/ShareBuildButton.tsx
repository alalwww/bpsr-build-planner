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

// LINE Social Plugins デザインガイドの「モノクロ・四角」ボタン画像(sample/line_square-grey.png、
// 公式配布アセット)を potrace でトレースしてパス化したもの。バッジ(角丸の四角)本体と
// 吹き出し+"LINE"文字を別パスに分け、どちらも状態(非活性/ホバー等)に関わらず固定色で塗る
// (強調はボタン側のopacityで表現するため、アイコン自体の色は変化させない)。
const LINE_BADGE_COLOR = '#2a2a33';
const LINE_BUBBLE_COLOR = 'white';
const LINE_BADGE_PATH =
  'M 2.174 2.314 C 0.059 4.566, 0 5.324, 0 30.126 C 0 54.403, 0.098 55.728, 2.039 57.811 C 4.035 59.954, 4.624 60, 29.903 60 L 55.727 60 58.364 57.364 L 61 54.727 61 28.805 C 61 14.443, 60.614 3.121, 60.134 3.417 C 59.657 3.712, 58.462 3.063, 57.479 1.976 C 55.786 0.106, 54.318 0, 30.019 0 C 4.479 0, 4.338 0.012, 2.174 2.314';
const LINE_BUBBLE_AND_TEXT_PATH =
  'M 24.500 9.888 C 13.477 12.746, 6.509 21.937, 8.499 30.996 C 9.803 36.932, 19.253 45, 24.901 45 C 27.328 45, 28.533 46.763, 28.148 49.750 C 27.750 52.823, 28.754 52.609, 35.595 48.159 C 51.570 37.766, 55.940 26.696, 47.749 17.367 C 42.291 11.151, 32.177 7.897, 24.500 9.888 M 15 28 L 15 33 18.500 33 C 20.425 33, 22 32.550, 22 32 C 22 31.450, 20.875 31, 19.500 31 C 17.250 31, 17 30.600, 17 27 C 17 24.800, 16.550 23, 16 23 C 15.450 23, 15 25.250, 15 28 M 23 28 C 23 31.778, 23.367 33, 24.500 33 C 25.633 33, 26 31.778, 26 28 C 26 24.222, 25.633 23, 24.500 23 C 23.367 23, 23 24.222, 23 28 M 27 28 C 27 31.778, 27.367 33, 28.500 33 C 29.463 33, 30.010 32.016, 30.027 30.250 L 30.053 27.500 31.758 30.250 C 34.437 34.570, 36 33.741, 36 28 C 36 25.250, 35.550 23, 35 23 C 34.450 23, 33.984 24.238, 33.964 25.750 L 33.928 28.500 31.676 25.750 C 28.287 21.611, 27 22.230, 27 28 M 38 28 L 38 33 41.500 33 C 43.425 33, 45 32.550, 45 32 C 45 31.450, 43.875 31, 42.500 31 C 41.125 31, 40 30.550, 40 30 C 40 29.450, 41.125 29, 42.500 29 C 43.875 29, 45 28.550, 45 28 C 45 27.450, 43.875 27, 42.500 27 C 41.125 27, 40 26.550, 40 26 C 40 25.450, 41.125 25, 42.500 25 C 43.875 25, 45 24.550, 45 24 C 45 23.450, 43.425 23, 41.500 23 L 38 23 38 28';

function LineIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 60 60" width={size} height={size} aria-hidden="true">
      <path d={LINE_BADGE_PATH} fill={LINE_BADGE_COLOR} />
      <path d={LINE_BUBBLE_AND_TEXT_PATH} fill={LINE_BUBBLE_COLOR} fillRule="evenodd" />
    </svg>
  );
}

const SHARE_ICON_PATH =
  'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z';
// X(旧Twitter)公式ロゴ(viewBox 0 0 1200 1227)。
const X_ICON_PATH =
  'M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z';
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
          confirmLabel={t('buildPlanner.close', { defaultValue: '閉じる' })}
          onConfirm={() => onOpenChange(false)}
          cancelLabel={t('buildPlanner.switchToExport', { defaultValue: 'エクスポートへ切替' })}
          onCancel={handleSwitchToExport}
          onDismiss={() => onOpenChange(false)}
          closeOnOverlayClick={false}
          closeIcon
        >
          <ul className="share-dialog__notes">
            {noteItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <button
            type="button"
            className="confirm-dialog__btn confirm-dialog__btn--cancel"
            onClick={handleGenerate}
            disabled={loading || !!shortUrl}
          >
            {loading
              ? t('buildPlanner.generatingShortUrl', { defaultValue: '作成中…' })
              : shortUrl
                ? t('buildPlanner.shortUrlCreated', { defaultValue: '作成済み' })
                : t('buildPlanner.generateShortUrl', { defaultValue: '共有リンクを作成' })}
          </button>

          <div className="share-dialog__panel">
            <span className="share-dialog__panel-label">
              {t('buildPlanner.sharePanelLabel', { defaultValue: 'シェア' })}
            </span>
            {/* URL単体のコピー(貼り付け先を選ばない、最小限の共有) */}
            <div className="share-dialog__url-row">
              <input
                className={`confirm-dialog__input confirm-dialog__input--inline${
                  shortUrl ? '' : ' share-dialog__input--muted'
                }`}
                readOnly
                disabled={!shortUrl}
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

            {/* クラス名・能力スコア等を含む文面での共有/コピー(左端が本文コピー) */}
            <div className="share-dialog__icons">
              <button
                type="button"
                className="share-dialog__icon-btn share-dialog__icon-btn--copy"
                onClick={handleCopyText}
                disabled={!shortUrl}
                title={t('buildPlanner.shareCopyText', { defaultValue: '本文をコピー' })}
              >
                {textCopied ? '✓' : <Icon path={COPY_ICON_PATH} size={32} />}
              </button>
              <button
                type="button"
                className="share-dialog__icon-btn share-dialog__icon-btn--x"
                onClick={handleShareX}
                disabled={!shortUrl}
                title={t('buildPlanner.shareOnX', { defaultValue: 'Xで共有' })}
              >
                <Icon path={X_ICON_PATH} viewBox="0 0 1200 1227" size={32} />
              </button>
              <button
                type="button"
                className="share-dialog__icon-btn share-dialog__icon-btn--line"
                onClick={handleShareLine}
                disabled={!shortUrl}
                title={t('buildPlanner.shareOnLine', { defaultValue: 'LINEで共有' })}
              >
                <LineIcon size={36} />
              </button>
            </div>
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
