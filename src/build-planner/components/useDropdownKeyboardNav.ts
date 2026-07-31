import { useEffect, type RefObject } from 'react';

const OPTION_SELECTOR = 'button:not(:disabled)';
const SELECTED_SELECTOR = '[data-selected="true"], [class*="--selected"]';

// 開いているドロップダウンパネル内での上下矢印キーによるフォーカス移動(ローミングフォーカス)
// を提供する共通フック。Dropdown/EvoSlotPicker/LegendaryAffixPickerで共通利用する。
// パネルが開いた瞬間、選択中の項目(data-selected="true" または末尾が --selected のクラス、
// このリポジトリ内の選択肢ボタンで共通のマーキング規約)にフォーカスを移し、以降
// ArrowUp/ArrowDown/Home/Endで兄弟ボタン間をフォーカス移動する。選択の確定(Enter/Space)は
// フォーカスされたbutton要素のネイティブ挙動に任せる。Escape/Tab/Shift+Tabでは閉じてトリガーへ
// フォーカスを戻す(パネルはdocument.bodyへportalされ、トリガーとはDOM上の親子関係が
// 無いため、Tabのネイティブ既定動作に任せるとポータル位置に依存した予測不能な先へ
// 飛んでしまう。ネイティブselectの「Tabで閉じて次要素へ」に相当する挙動を明示的に再現する)。
// readyはisOpenとパネルの実マウント状態(useDelayedUnmount由来)の両方を満たすタイミングを
// 呼び出し側から渡す想定(1レンダー早いとpanelRef.currentがまだnullのため)。
export function useDropdownKeyboardNav(
  panelRef: RefObject<HTMLElement | null>,
  ready: boolean,
  onClose: () => void,
  triggerRef?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!ready) return;
    const panel = panelRef.current;
    if (!panel) return;

    const getOptions = () => Array.from(panel.querySelectorAll<HTMLElement>(OPTION_SELECTOR));

    const options = getOptions();
    const selected = panel.querySelector<HTMLElement>(SELECTED_SELECTOR);
    (selected ?? options[0])?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      const opts = getOptions();
      if (opts.length === 0) return;
      const currentIndex = opts.indexOf(document.activeElement as HTMLElement);
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          opts[(currentIndex + 1 + opts.length) % opts.length]?.focus();
          break;
        case 'ArrowUp':
          e.preventDefault();
          opts[(currentIndex - 1 + opts.length) % opts.length]?.focus();
          break;
        case 'Home':
          e.preventDefault();
          opts[0]?.focus();
          break;
        case 'End':
          e.preventDefault();
          opts[opts.length - 1]?.focus();
          break;
        case 'Escape':
        case 'Tab':
          e.preventDefault();
          onClose();
          triggerRef?.current?.focus();
          break;
      }
    };
    panel.addEventListener('keydown', handleKeyDown);
    return () => panel.removeEventListener('keydown', handleKeyDown);
  }, [panelRef, ready, onClose, triggerRef]);
}
