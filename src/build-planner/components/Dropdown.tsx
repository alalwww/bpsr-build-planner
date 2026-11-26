import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useDelayedUnmount } from './useDelayedUnmount';
import { useIsMobile } from './useMediaQuery';
import { computeDropdownPlacement } from './useDropdownPlacement';
import { useDropdownKeyboardNav } from './useDropdownKeyboardNav';

const CLOSE_ANIM_MS = 150;

interface DropdownProps {
  triggerClassName: string | ((isOpen: boolean) => string);
  renderTrigger: (isOpen: boolean) => ReactNode;
  panelClassName: string;
  children: (close: () => void) => ReactNode;
  autoFocus?: boolean;
  /** パネル幅 = トリガー幅 × この値(既定1)。改行を減らしたい時などにトリガーより広げる。 */
  panelWidthScale?: number;
  /**
   * トリガーが閉じている間のキー操作をトリガーへ橋渡しするための拡張ポイント。
   * 上下矢印キーでパネルを開かずに選択を直接変更したい場合、useArrowKeySelect フックで
   * 作ったハンドラをここに渡す(ネイティブselectやStepperのコンボと同じ操作感)。
   * 開いている間はここを呼ばない(その間の矢印キーは useDropdownKeyboardNav が
   * パネル側で処理する)。
   */
  onTriggerKeyDown?: (e: ReactKeyboardEvent<HTMLButtonElement>) => void;
  /** パネルの既定の最大高さ(px)。画面の余白がこれより狭い場合はさらに縮められる。既定320。 */
  maxPanelHeight?: number;
  /** true の場合、パネル幅をトリガー幅以上・内容の幅(max-content)に合わせる(幅の狭いトリガー用)。 */
  panelFitContent?: boolean;
  /** true の間はトリガーを無効化し、開いていれば閉じる。 */
  disabled?: boolean;
  /** トリガーのツールチップ(title)。 */
  triggerTitle?: string;
  /** トリガーのアクセシブルネーム(aria-label)。 */
  triggerAriaLabel?: string;
  /** 開閉状態を呼び出し側で管理する場合の開閉状態(onOpenChange と併せて指定する)。 */
  open?: boolean;
  /** 開閉状態の変更要求(open 指定時)。 */
  onOpenChange?: (open: boolean) => void;
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
  onTriggerKeyDown,
  maxPanelHeight = 320,
  panelFitContent = false,
  disabled = false,
  triggerTitle,
  triggerAriaLabel,
  open,
  onOpenChange,
}: DropdownProps) {
  // 開閉状態は既定では内部で持ち、open 指定時は呼び出し側の状態に従う(同時に1つだけ開く等の
  // 制御を呼び出し側で行いたい場合)。
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  // イベントハンドラ(effect内で登録したもの含む)から常に最新の状態・コールバックを参照する。
  const latestRef = useRef({ isOpen, open, onOpenChange });
  latestRef.current = { isOpen, open, onOpenChange };
  const setIsOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    const latest = latestRef.current;
    const value = typeof next === 'function' ? next(latest.isOpen) : next;
    if (latest.open === undefined) setInternalOpen(value);
    if (value !== latest.isOpen) latest.onOpenChange?.(value);
  };
  const [pos, setPos] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    maxHeight: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const shouldRender = useDelayedUnmount(isOpen, CLOSE_ANIM_MS);
  // スマホ相当の画面(狭い画面・横向きで高さが低い画面)では、トリガー直下に開く小さなパネルの
  // 代わりに、画面下から出る大きめのシート(ボトムシート)で選択肢を表示する(タップしやすく、
  // 画面端でパネルが潰れない)。背景のタップでも閉じられる。
  const sheet = useIsMobile();

  const close = () => setIsOpen(false);
  // 選択肢を選んだ後の close は、外側クリックでの close と異なりトリガーへフォーカスを
  // 戻す(パネルの選択肢ボタンはアンマウントされるため、明示的に戻さないとフォーカスが
  // 失われる)。children にはこちらを渡す。
  const closeAfterSelect = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  // スマホ等、トリガーが画面下部に近い位置にある場合は選択肢パネルが画面外に
  // はみ出してしまうため、下に十分な余白がなければ上に開き、その方向で使える
  // 高さを超える分はパネル側のスクロール(下部の style 指定)に任せる。
  const updatePos = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const { direction, maxHeight: availableHeight } = computeDropdownPlacement(rect);
    setPos({
      left: rect.left,
      width: rect.width * panelWidthScale,
      maxHeight: Math.min(availableHeight, maxPanelHeight),
      ...(direction === 'up'
        ? { bottom: window.innerHeight - rect.top + 2 }
        : { top: rect.bottom + 2 }),
    });
  };

  const toggle = () => {
    if (disabled) return;
    if (!isOpen) updatePos();
    setIsOpen((v) => !v);
  };

  // 呼び出し側の状態で開かれた場合(open 指定時)も位置を計算する。
  useLayoutEffect(() => {
    if (isOpen && !sheet) updatePos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sheet]);

  // 無効化されたら閉じる
  useEffect(() => {
    if (disabled) setIsOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!isOpen) return;
    // マウス・タッチ・ペンのいずれでも外側の操作で閉じられるよう pointerdown で判定する。
    const handler = (e: PointerEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !panelRef.current?.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // 開いている間、外側UIのスクロール/リサイズでトリガーの位置が変わったらパネルを追従させる。
  // scrollイベントはバブリングしないため、任意の祖先スクロールコンテナを検知できるよう
  // キャプチャフェーズで監視する。
  useEffect(() => {
    if (!isOpen || sheet) return;
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sheet]);

  // 開いた瞬間、選択中の選択肢(data-selected="true")が見えていなければそこまでスクロールする。
  // ペイント前に反映するため useLayoutEffect を使う(一瞬先頭が見えてから飛ぶ、を防ぐ)。
  // shouldRenderはuseDelayedUnmount由来で isOpen が true になった1レンダー後に true になる
  // (退出アニメーションのため即アンマウントしない仕組み)。依存配列に isOpen しか無いと、
  // パネルがまだDOMに存在しない(panelRef.current が null の)最初のレンダーでこのeffectが
  // 実行されてしまい、以降 isOpen が変化しない限り再実行されずスクロールが効かなくなる。
  useLayoutEffect(() => {
    if (!isOpen || !shouldRender) return;
    const selected = panelRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
    selected?.scrollIntoView({ block: 'center' });
  }, [isOpen, shouldRender]);

  // 開いている間、上下矢印キーで選択肢間をフォーカス移動できるようにする。
  useDropdownKeyboardNav(panelRef, isOpen && shouldRender, close, triggerRef);

  const resolvedTriggerClassName =
    typeof triggerClassName === 'function' ? triggerClassName(isOpen) : triggerClassName;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={resolvedTriggerClassName}
        onClick={toggle}
        onKeyDown={onTriggerKeyDown && !isOpen && !disabled ? onTriggerKeyDown : undefined}
        autoFocus={autoFocus}
        disabled={disabled}
        title={triggerTitle}
        aria-label={triggerAriaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {renderTrigger(isOpen)}
      </button>
      {shouldRender &&
        sheet &&
        createPortal(
          <div className={`dropdown-sheet${isOpen ? '' : ' dropdown-sheet--closing'}`}>
            <div className="dropdown-sheet__backdrop" />
            <div
              ref={panelRef}
              className="dropdown-sheet__panel"
              role="dialog"
              aria-label={triggerAriaLabel ?? triggerTitle}
            >
              {triggerTitle && <div className="dropdown-sheet__title">{triggerTitle}</div>}
              <div className={`dropdown-sheet__list ${panelClassName}`}>
                {children(closeAfterSelect)}
              </div>
            </div>
          </div>,
          document.body,
        )}
      {shouldRender &&
        !sheet &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            className={`dropdown-panel-anim${isOpen ? '' : ' dropdown-panel-anim--closing'}`}
            style={{
              position: 'fixed',
              left: pos.left,
              ...(panelFitContent
                ? { minWidth: pos.width, width: 'max-content' }
                : { width: pos.width }),
              zIndex: 1000,
              ...(pos.top !== undefined ? { top: pos.top } : { bottom: pos.bottom }),
            }}
          >
            <div className="dropdown-panel-anim__inner">
              <div
                className={panelClassName}
                style={{ maxHeight: pos.maxHeight, overflowY: 'auto' }}
              >
                {children(closeAfterSelect)}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default Dropdown;
