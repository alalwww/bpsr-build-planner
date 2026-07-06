import { useRef, useState } from 'react';

// マウスカーソルとポップアップの間の余白(px)。
export const CURSOR_TOOLTIP_GAP = 20;
// ホバー解除後、ピン留めされていなければこの時間後に閉じる(ms)。
const CLOSE_DELAY = 120;

export interface CursorTooltipState<T> {
  key: T;
  x: number;
  y: number;
  pinned: boolean;
}

export interface CursorTooltipHandlers {
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}

// ホバー中はマウスカーソルに追従し、クリックでその位置に固定(ピン留め)、
// 再度同じ対象をクリックするとピン留め解除、といった挙動を持つポップアップの
// 位置/表示状態を共通化するフック。Skill/Module/装備パネルの各ポップアップで共用する。
export function useCursorTooltip<T>(isSameKey: (a: T, b: T) => boolean) {
  const [tooltip, setTooltip] = useState<CursorTooltipState<T> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setTooltip(null), CLOSE_DELAY);
  };

  const close = () => {
    cancelClose();
    setTooltip(null);
  };

  const posFor = (e: React.MouseEvent, align: 'left' | 'right') => ({
    x: align === 'left' ? e.clientX - CURSOR_TOOLTIP_GAP : e.clientX + CURSOR_TOOLTIP_GAP,
    y: e.clientY,
  });

  const makeHandlers = (key: T, align: 'left' | 'right' = 'right'): CursorTooltipHandlers => {
    const isCurrent = () => tooltip !== null && isSameKey(tooltip.key, key);
    return {
      onMouseEnter: (e) => {
        cancelClose();
        if (!tooltip?.pinned) setTooltip({ key, ...posFor(e, align), pinned: false });
      },
      onMouseMove: (e) => {
        if (tooltip?.pinned) return;
        if (!isCurrent()) return;
        setTooltip((prev) => (prev ? { ...prev, ...posFor(e, align) } : prev));
      },
      onMouseLeave: () => {
        if (!tooltip?.pinned) scheduleClose();
      },
      onMouseDown: (e) => {
        // ドキュメント側の mousedown-outside-close ハンドラがアイコン自身のクリックで
        // 誤発火しないようにする
        e.stopPropagation();
      },
      onClick: (e) => {
        e.stopPropagation();
        if (isCurrent() && tooltip?.pinned) {
          setTooltip((prev) => (prev ? { ...prev, pinned: false } : null));
        } else {
          setTooltip({ key, ...posFor(e, align), pinned: true });
        }
      },
    };
  };

  return { tooltip, makeHandlers, cancelClose, scheduleClose, close };
}
