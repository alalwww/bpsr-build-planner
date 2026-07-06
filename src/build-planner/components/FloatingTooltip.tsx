import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';

interface FloatingTooltipProps {
  x: number;
  y: number;
  className: string;
  /** 画面端でのはみ出しを防ぐよう描画後に位置を補正する。既定 false。 */
  clamp?: boolean;
  /** 'right'(既定): xを要素の左端として右側に表示。'left': xを要素の右端として左側に表示。clamp=true時のみ有効。 */
  align?: 'right' | 'left';
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  /** 指定時、この要素の外側を mousedown したら呼び出す(ピン留め/クリック開閉ポップアップ用)。 */
  onRequestClose?: () => void;
  children: ReactNode;
}

// マウス位置/対象要素の矩形を基準に固定位置で浮かせる説明ツールチップの共通シェル。
// 表示/非表示のタイミング制御(遅延クローズ等)は呼び出し側の責務とし、
// このコンポーネントは位置決め・クランプ・外側クリックでの close のみを担う。
function FloatingTooltip({
  x,
  y,
  className,
  clamp = false,
  align = 'right',
  onMouseEnter,
  onMouseLeave,
  onRequestClose,
  children,
}: FloatingTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!clamp) return;
    const el = ref.current;
    if (!el) return;
    const width = el.getBoundingClientRect().width;
    const left = align === 'left' ? x - width : x;
    el.style.left = `${left}px`;
    el.style.top = `${y}px`;
    const rect = el.getBoundingClientRect();
    const overflowY = rect.bottom - (window.innerHeight - 8);
    const overflowX = rect.right - (window.innerWidth - 8);
    const underflowX = 8 - rect.left;
    if (overflowY > 0) el.style.top = `${Math.max(8, y - overflowY)}px`;
    if (overflowX > 0) el.style.left = `${Math.max(8, left - overflowX)}px`;
    else if (underflowX > 0) el.style.left = `${left + underflowX}px`;
  }, [x, y, clamp, align]);

  useEffect(() => {
    if (!onRequestClose) return;
    const handler = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onRequestClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onRequestClose]);

  return (
    <div
      ref={ref}
      className={className}
      style={clamp ? { position: 'fixed' } : { position: 'fixed', left: x, top: y }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
}

export default FloatingTooltip;
