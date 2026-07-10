import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useDraggable } from './useDraggable';

interface Size {
  w: number;
  h: number;
}

interface Pos {
  x: number;
  y: number;
}

interface DraggableDialogProps {
  /** ヘッダー(タイトルバー+✕ボタン)のタイトル。省略するとヘッダー自体を描画せず、
   * ドラッグ不可の中央固定モーダルとして振る舞う(ConfirmDialog等が利用)。 */
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  headerExtra?: ReactNode;
  /** 背景を暗転させ、外側クリックで閉じるオーバーレイを表示するか。既定 true。 */
  overlay?: boolean;
  /** リサイズハンドルを表示し、位置をドラッグ+リサイズ可能にするか。既定 false(中央固定+ドラッグ移動のみ)。 */
  resizable?: boolean;
  initialPos?: Pos;
  initialSize?: Size;
  minSize?: Size;
}

const DEFAULT_SIZE: Size = { w: 480, h: 560 };
const DEFAULT_MIN_SIZE: Size = { w: 280, h: 200 };

// ドラッグ移動(+任意でリサイズ)可能なダイアログの共通シェル。
// draggable-dialog系のCSSクラス(overlay/header/title/close/resize-handle)を担い、
// 各呼び出し元は className でサイズ用のモディファイアクラスのみ追加する。
function DraggableDialog({
  title,
  onClose,
  children,
  className,
  headerExtra,
  overlay = true,
  resizable = false,
  initialPos,
  initialSize = DEFAULT_SIZE,
  minSize = DEFAULT_MIN_SIZE,
}: DraggableDialogProps) {
  const { offset, onDragHandleMouseDown } = useDraggable();

  const [pos, setPos] = useState<Pos>(
    () =>
      initialPos ?? {
        x: Math.max(0, (window.innerWidth - initialSize.w) / 2),
        y: Math.max(0, (window.innerHeight - initialSize.h) / 2),
      },
  );
  const [size, setSize] = useState<Size>(initialSize);
  const dragRef = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const resizeRef = useRef<{ ox: number; oy: number; w: number; h: number } | null>(null);

  const onFixedHeaderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { ox: e.clientX, oy: e.clientY, px: pos.x, py: pos.y };
  };

  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { ox: e.clientX, oy: e.clientY, w: size.w, h: size.h };
  };

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (dragRef.current) {
        setPos({
          x: dragRef.current.px + e.clientX - dragRef.current.ox,
          y: dragRef.current.py + e.clientY - dragRef.current.oy,
        });
      }
      if (resizeRef.current) {
        setSize({
          w: Math.max(minSize.w, resizeRef.current.w + e.clientX - resizeRef.current.ox),
          h: Math.max(minSize.h, resizeRef.current.h + e.clientY - resizeRef.current.oy),
        });
      }
    },
    [minSize.w, minSize.h],
  );

  const onMouseUp = useCallback(() => {
    dragRef.current = null;
    resizeRef.current = null;
  }, []);

  useEffect(() => {
    if (!resizable) return;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [resizable, onMouseMove, onMouseUp]);

  const dialogStyle: CSSProperties = resizable
    ? { position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, zIndex: 1000 }
    : { transform: `translate(${offset.x}px, ${offset.y}px)` };

  const dialogBox = (
    <div
      className={`draggable-dialog${resizable ? ' draggable-dialog--resizable' : ''}${className ? ` ${className}` : ''}`}
      style={dialogStyle}
      onClick={(e) => e.stopPropagation()}
    >
      {title !== undefined && (
        <div
          className="draggable-dialog__header"
          onMouseDown={resizable ? onFixedHeaderMouseDown : onDragHandleMouseDown}
        >
          <h2 className="draggable-dialog__title">{title}</h2>
          {headerExtra}
          <button type="button" className="draggable-dialog__close" onClick={onClose}>
            ✕
          </button>
        </div>
      )}
      {children}
      {resizable && (
        <div className="draggable-dialog__resize-handle" onMouseDown={onResizeMouseDown} />
      )}
    </div>
  );

  if (!overlay) return dialogBox;

  return (
    <div className="draggable-dialog-overlay" onClick={onClose}>
      {dialogBox}
    </div>
  );
}

export default DraggableDialog;
