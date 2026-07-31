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
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const shouldRender = useDelayedUnmount(isOpen, CLOSE_ANIM_MS);

  const close = () => setIsOpen(false);
  // 選択肢を選んだ後の close は、外側クリックでの close と異なりトリガーへフォーカスを
  // 戻す(パネルの選択肢ボタンはアンマウントされるため、明示的に戻さないとフォーカスが
  // 失われる)。children にはこちらを渡す。
  const closeAfterSelect = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

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
        onKeyDown={onTriggerKeyDown && !isOpen ? onTriggerKeyDown : undefined}
        autoFocus={autoFocus}
      >
        {renderTrigger(isOpen)}
      </button>
      {shouldRender &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            className={`dropdown-panel-anim${isOpen ? '' : ' dropdown-panel-anim--closing'}`}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 1000,
            }}
          >
            <div className="dropdown-panel-anim__inner">
              <div className={panelClassName}>{children(closeAfterSelect)}</div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default Dropdown;
