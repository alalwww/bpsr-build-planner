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
  /** アクション行の左端に置く別系統の切り替えボタン(例: インポートへ切替)。
   * confirm/cancel(右寄せ)とは独立して左寄せで表示する。 */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** 背景クリックで閉じる際の挙動。省略時は onCancel ?? onConfirm(通常の確認/キャンセル
   * ダイアログと同じ)。onCancelを「キャンセル」以外の用途(切り替え等)に使っている場合、
   * 背景クリックだけは素直に閉じたい(切り替えを誤爆させたくない)ときに指定する。 */
  onDismiss?: () => void;
  /** falseにすると背景クリックで閉じなくなる(誤操作で閉じられたくないダイアログ用)。既定 true。 */
  closeOnOverlayClick?: boolean;
  /** trueにすると右上に✕アイコンを表示する。onDismiss ?? onCancel ?? onConfirm を呼ぶ
   * (onConfirmが送信/実行系の処理でも、✕は素直に閉じるだけにするため)。
   * confirmLabelはアイコンのaria-label/titleとして使う。既定 false。 */
  closeIcon?: boolean;
  /** trueにすると下部の確定ボタン(confirmLabel)を表示しない。✕アイコン単独で閉じる、
   * かつ確定ボタンが冗長なダイアログ(閉じる=確定なだけのもの)向け。既定 false。 */
  hideConfirmButton?: boolean;
  /** アクション行の下にもう1行追加する(例: 別ダイアログへの切り替えボタンを右寄せで)。 */
  footer?: ReactNode;
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
  secondaryLabel,
  onSecondary,
  onDismiss,
  closeOnOverlayClick = true,
  closeIcon = false,
  hideConfirmButton = false,
  footer,
  className,
}: ConfirmDialogProps) {
  const handleDismiss = onDismiss ?? onCancel ?? onConfirm;
  return (
    <DraggableDialog
      onClose={handleDismiss}
      closeOnOverlayClick={closeOnOverlayClick}
      className={`confirm-dialog${className ? ` ${className}` : ''}`}
    >
      {closeIcon && (
        <button
          type="button"
          className="confirm-dialog__close-icon"
          onClick={handleDismiss}
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
        <div className="confirm-dialog__actions-left">
          {onSecondary && secondaryLabel && (
            <button
              type="button"
              className="confirm-dialog__btn confirm-dialog__btn--cancel"
              onClick={onSecondary}
            >
              {secondaryLabel}
            </button>
          )}
        </div>
        <div className="confirm-dialog__actions-right">
          {!hideConfirmButton && (
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
      </div>
      {footer}
    </DraggableDialog>
  );
}

export default ConfirmDialog;
