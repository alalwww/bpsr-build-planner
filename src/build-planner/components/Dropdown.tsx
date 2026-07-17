import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
// 呼び出し側は、現在選択中の選択肢要素に data-selected="true" を付与することで、
// 開いた瞬間にその位置までスクロールした状態を初期表示にできる。
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

  const updatePos = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 2, left: rect.left, width: rect.width * panelWidthScale });
  };

  const toggle = () => {
    if (!isOpen) updatePos();
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

  // 開いている間、外側UIのスクロール/リサイズでトリガーの位置が変わったらパネルを追従させる。
  // scrollイベントはバブリングしないため、任意の祖先スクロールコンテナを検知できるよう
  // キャプチャフェーズで監視する。
  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // 開いた瞬間、選択中の選択肢(data-selected="true")が見えていなければそこまでスクロールする。
  // ペイント前に反映するため useLayoutEffect を使う(一瞬先頭が見えてから飛ぶ、を防ぐ)。
  useLayoutEffect(() => {
    if (!isOpen) return;
    const selected = panelRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
    selected?.scrollIntoView({ block: 'center' });
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
