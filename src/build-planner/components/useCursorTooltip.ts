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

// クリックが別の意味(選択操作等)を持つ要素向けの、ホバー追従表示のみのハンドラ部分集合。
// クリックでピン留めするonClick/onMouseDownを含まない。
export type CursorTooltipHoverHandlers = Pick<
  CursorTooltipHandlers,
  'onMouseEnter' | 'onMouseMove' | 'onMouseLeave'
>;

// ホバー中はマウスカーソルに追従し、クリックでその位置に固定(ピン留め)、
// 再度同じ対象をクリックするとピン留め解除、といった挙動を持つポップアップの
// 位置/表示状態を共通化するフック。Skill/Module/装備パネルの各ポップアップで共用する。
//
// hoverDelay(ms、既定0=即時表示)を指定すると、表示中のものと異なる対象へホバー移動した
// 場合は一旦閉じ(即座に非表示にし)、カーソルが動かずこの時間とどまり続けて初めて新しい
// 内容を表示する(いわゆるhover intent)。要素内でカーソルが動くたびタイマーは最新位置で
// リセットされるため、動き続けている間は表示されない。同一対象への再入場(closeの
// グレース期間中に一瞬外れて戻ってきた場合等)は「切り替わっていない」とみなし、
// 待たせずそのまま表示を継続する。
export function useCursorTooltip<T>(isSameKey: (a: T, b: T) => boolean, hoverDelay = 0) {
  const [tooltip, setTooltip] = useState<CursorTooltipState<T> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const cancelOpen = () => {
    if (openTimerRef.current !== null) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    cancelOpen();
    cancelClose();
    closeTimerRef.current = setTimeout(() => setTooltip(null), CLOSE_DELAY);
  };

  const close = () => {
    cancelOpen();
    cancelClose();
    setTooltip(null);
  };

  const posFor = (e: React.MouseEvent, align: 'left' | 'right') => ({
    x: align === 'left' ? e.clientX - CURSOR_TOOLTIP_GAP : e.clientX + CURSOR_TOOLTIP_GAP,
    y: e.clientY,
  });

  const makeHandlers = (key: T, align: 'left' | 'right' = 'right'): CursorTooltipHandlers => {
    const isCurrent = () => tooltip !== null && isSameKey(tooltip.key, key);
    // ホバー中(enter/move共通)。要素内でカーソルが動くたびonMouseMoveからも呼ぶことで、
    // hover intentの表示待ちタイマーを最新のカーソル位置でリセットする(=動き続けている
    // 間は表示されず、静止して初めて表示される)。既に表示中(isCurrent)なら遅延なく
    // 位置だけを更新する。
    const hover = (e: React.MouseEvent) => {
      cancelClose();
      if (tooltip?.pinned) return;
      cancelOpen();
      const pos = posFor(e, align);
      if (hoverDelay > 0 && !isCurrent()) {
        if (tooltip !== null) setTooltip(null);
        openTimerRef.current = setTimeout(() => {
          openTimerRef.current = null;
          setTooltip({ key, ...pos, pinned: false });
        }, hoverDelay);
      } else {
        setTooltip({ key, ...pos, pinned: false });
      }
    };
    return {
      onMouseEnter: hover,
      onMouseMove: hover,
      onMouseLeave: () => {
        cancelOpen();
        if (!tooltip?.pinned) scheduleClose();
      },
      onMouseDown: (e) => {
        // ドキュメント側の mousedown-outside-close ハンドラがアイコン自身のクリックで
        // 誤発火しないようにする
        e.stopPropagation();
      },
      onClick: (e) => {
        e.stopPropagation();
        // 保留中のホバー遅延表示タイマーがあれば止める。放置すると、クリックで固定した
        // 直後に古い(非固定の)内容でタイマーが発火し、固定表示を上書きしてしまう。
        cancelOpen();
        if (isCurrent() && tooltip?.pinned) {
          // 固定中の対象を再クリック=固定解除。ホバー追従表示に戻すのではなく閉じる。
          close();
        } else {
          setTooltip({ key, ...posFor(e, align), pinned: true });
        }
      },
    };
  };

  return { tooltip, makeHandlers, cancelClose, scheduleClose, close };
}
