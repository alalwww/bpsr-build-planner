import { type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface DropdownProps {
  triggerClassName: string | ((isOpen: boolean) => string);
  renderTrigger: (isOpen: boolean) => ReactNode;
  panelClassName: string;
  children: (close: () => void) => ReactNode;
  autoFocus?: boolean;
  /** パネル幅 = トリガー幅 × この値(既定1)。改行を減らしたい時などにトリガーより広げる。 */
  panelWidthScale?: number;
}

// 「トリガーボタン → document.bodyへportalした固定位置の選択肢パネル」という
// ドロップダウン系UIの共通シェル。開閉state・位置計算・外側クリックでの close を担う。
// パネルの中身(グルーピング・アイコン・説明ツールチップ等)は呼び出し側が children で描画する。
function Dropdown({
  triggerClassName,
  renderTrigger,
  panelClassName,
  children,
  autoFocus,
  panelWidthScale = 1,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = () => setIsOpen(false);

  const toggle = () => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 2, left: rect.left, width: rect.width * panelWidthScale });
    }
    setIsOpen((v) => !v);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !panelRef.current?.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const resolvedTriggerClassName =
    typeof triggerClassName === 'function' ? triggerClassName(isOpen) : triggerClassName;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={resolvedTriggerClassName}
        onClick={toggle}
        autoFocus={autoFocus}
      >
        {renderTrigger(isOpen)}
      </button>
      {isOpen &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            className={panelClassName}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 1000,
            }}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </>
  );
}

export default Dropdown;
