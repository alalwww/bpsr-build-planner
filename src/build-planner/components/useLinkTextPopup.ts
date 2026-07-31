import { useRef, useState } from 'react';
import type { LinkTextHandlers } from './renderMarkup';

// ネストしたlinktextポップアップの、クリック位置からの水平オフセット(px)。
export const LINKTEXT_POPUP_GAP = 16;
// トリガー要素/ポップアップ自体の双方からポインタが外れた後、この時間後に閉じる(ms)。
const CLOSE_DELAY = 120;

export interface LinkTextPopupState {
  id: number;
  x: number;
  y: number;
}

// <linktext=ID>...</linktext> をクリックした際に、その説明をネストしたポップアップで表示する
// ための開閉状態フック。ロック(ピン留め)はできず、トリガー要素またはポップアップ自体の上に
// ポインタがある間だけ表示を維持する。SkillTooltip/StatTooltip/TalentTreePanel/
// PhantomNodeEffect など、renderMarkup を使うあらゆる場所で共通利用する。
export function useLinkTextPopup() {
  const [popup, setPopup] = useState<LinkTextPopupState | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setPopup(null), CLOSE_DELAY);
  };

  const handlers: LinkTextHandlers = {
    isOpen: (id) => popup?.id === id,
    onClick: (id, e) => {
      cancelClose();
      // 既にポップアップが開いている場合(=ポップアップ内のlinktextをクリックして中身を
      // 差し替える場合)は位置を変えず内容だけ差し替える。クリック位置に合わせて箱ごと
      // 動かすと、動かした箱の下にポインタが残るだけで実際には触れていない状態になり、
      // その後ポインタを離してもブラウザ側でこの箱に対する新たなmouseenter/mouseleaveの
      // 対が発生せず(座標は変わっていないため)、閉じるきっかけを失って開いたままになる。
      // 箱の位置を固定しておけば、開いた瞬間から出ているmouseenter状態がそのまま有効な
      // ままなので、後で本当にポインタが離れた時に正しくmouseleaveが発火する。
      setPopup((prev) =>
        prev ? { ...prev, id } : { id, x: e.clientX + LINKTEXT_POPUP_GAP, y: e.clientY },
      );
    },
    onMouseEnter: (id) => {
      if (popup?.id === id) cancelClose();
    },
    onMouseLeave: () => {
      scheduleClose();
    },
  };

  return { popup, handlers, cancelClose, scheduleClose };
}
