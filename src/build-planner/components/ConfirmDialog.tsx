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
  /** 背景クリックで閉じる際の挙動。省略時は onCancel ?? onConfirm(通常の確認/キャンセル
   * ダイアログと同じ)。onCancelを「キャンセル」以外の用途(切り替え等)に使っている場合、
   * 背景クリックだけは素直に閉じたい(切り替えを誤爆させたくない)ときに指定する。 */
  onDismiss?: () => void;
  /** falseにすると背景クリックで閉じなくなる(誤操作で閉じられたくないダイアログ用)。既定 true。 */
  closeOnOverlayClick?: boolean;
  /** trueにすると下部の確定ボタン(confirmLabel)の代わりに右上の✕アイコンで閉じる形にする。
   * アイコンはonConfirmを呼ぶ(confirmLabelはアイコンのaria-labelとして使う)。既定 false。 */
  closeIcon?: boolean;
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
  onDismiss,
  closeOnOverlayClick = true,
  closeIcon = false,
  className,
}: ConfirmDialogProps) {
  return (
    <DraggableDialog
      onClose={onDismiss ?? onCancel ?? onConfirm}
      closeOnOverlayClick={closeOnOverlayClick}
      className={`confirm-dialog${className ? ` ${className}` : ''}`}
    >
      {closeIcon && (
        <button
          type="button"
          className="confirm-dialog__close-icon"
          onClick={onConfirm}
          aria-label={confirmLabel}
          title={confirmLabel}
        >
          ✕
        </button>
      )}
      {title !== undefined && <p className="confirm-dialog__title">{title}</p>}
      {message !== undefined && <p className="confirm-dialog__message">{message}</p>}
      {children}
      <div className="confirm-dialog__actions">
        {!closeIcon && (
          <button
            type="button"
            className="confirm-dialog__btn confirm-dialog__btn--ok"
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        )}
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
