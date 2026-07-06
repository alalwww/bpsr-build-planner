import type { ReactNode } from 'react';
import DraggableDialog from './DraggableDialog';

interface ConfirmDialogProps {
  title?: ReactNode;
  message?: ReactNode;
  /** メッセージ以外の追加コンテンツ(入力欄・ステッパー・テーブル等)。アクションボタンの直前に描画。 */
  children?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  /** 省略するとキャンセルボタンを表示しない単一ボタンの通知ダイアログになる。 */
  cancelLabel?: string;
  onCancel?: () => void;
  className?: string;
}

// タイトルバーを持たない中央固定モーダル(DraggableDialogのtitle省略時の挙動)の上に
// メッセージ + OK/キャンセルの定型アクション行を乗せた確認ダイアログ。
// プラン保存/削除/読込確認やスキルリセット確認など、アプリ内の各種確認モーダルで共通利用する。
function ConfirmDialog({
  title,
  message,
  children,
  confirmLabel,
  onConfirm,
  confirmDisabled,
  cancelLabel,
  onCancel,
  className,
}: ConfirmDialogProps) {
  return (
    <DraggableDialog
      onClose={onCancel ?? onConfirm}
      className={`confirm-dialog${className ? ` ${className}` : ''}`}
    >
      {title !== undefined && <p className="confirm-dialog__title">{title}</p>}
      {message !== undefined && <p className="confirm-dialog__message">{message}</p>}
      {children}
      <div className="confirm-dialog__actions">
        <button
          type="button"
          className="confirm-dialog__btn confirm-dialog__btn--ok"
          onClick={onConfirm}
          disabled={confirmDisabled}
        >
          {confirmLabel}
        </button>
        {onCancel && cancelLabel && (
          <button
            type="button"
            className="confirm-dialog__btn confirm-dialog__btn--cancel"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
        )}
      </div>
    </DraggableDialog>
  );
}

export default ConfirmDialog;
