import { type RefObject, useLayoutEffect, useState } from 'react';

export interface DropdownPlacement {
  direction: 'down' | 'up';
  /** 使用可能な最大高さ(px)。これを超える分はパネル側のCSS(overflow-y: auto)でスクロールさせる。 */
  maxHeight: number;
}

const EDGE_MARGIN = 8;
// 下方向の余白がこれ未満で、かつ上方向の方が広ければ上に開く判定にする。
const MIN_SPACE_TO_PREFER_DOWN = 160;

// スマホ等、画面下部に近い位置でドロップダウンを開くと選択肢パネルが画面外に
// はみ出してしまう問題に対応するため、トリガー要素の画面内位置から
// 開く方向(下/上)と使用可能な最大高さを判定する。
export function computeDropdownPlacement(rect: DOMRect): DropdownPlacement {
  const spaceBelow = window.innerHeight - rect.bottom - EDGE_MARGIN;
  const spaceAbove = rect.top - EDGE_MARGIN;
  if (spaceBelow < MIN_SPACE_TO_PREFER_DOWN && spaceAbove > spaceBelow) {
    return { direction: 'up', maxHeight: Math.max(spaceAbove, 80) };
  }
  return { direction: 'down', maxHeight: Math.max(spaceBelow, 80) };
}

// 開いた瞬間のトリガー位置から配置を計算するフック。position:absoluteでスクロール
// コンテナに追従させる形式のドロップダウン(EvoSlotPicker/LegendaryAffixPicker等)向け。
// fixed+portal形式のDropdown.tsxはスクロール/リサイズにも追従させる必要があるため、
// こちらの関数を updatePos 内で直接呼んで独自に管理している。
export function useDropdownPlacement(
  triggerRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
): DropdownPlacement {
  const [placement, setPlacement] = useState<DropdownPlacement>({
    direction: 'down',
    maxHeight: 320,
  });

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    setPlacement(computeDropdownPlacement(triggerRef.current.getBoundingClientRect()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return placement;
}
