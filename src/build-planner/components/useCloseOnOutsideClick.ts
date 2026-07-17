import { useEffect, type RefObject } from 'react';

// 開いている間だけ、containerRef の外側でのクリック(mousedown)を検知して onClose を呼ぶ。
// トリガーボタンとパネルが同一コンテナ内(非ポータル)にある場合に使う想定。
// ポータルで別DOMに描画するパネルには使えない(Dropdown.tsx はトリガー/パネル別refで対応)。
export function useCloseOnOutsideClick(
  containerRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [containerRef, isOpen, onClose]);
}
