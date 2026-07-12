import { useRef, useState } from 'react';

// ホバー解除後、この時間内にツールチップ本体へマウスが乗らなければ閉じる(ms)。
// useCursorTooltip の CLOSE_DELAY と同じ値に揃えている。
const CLOSE_DELAY = 120;

// 要素(アンカー)の矩形を基準に表示し、ホバー解除後は少し遅れて閉じるツールチップの
// 開閉状態とタイマーを共通化するフック。アンカー側は open(payload)/scheduleClose を、
// ツールチップ本体側は cancelClose/scheduleClose を onMouseEnter/onMouseLeave に渡すことで、
// アンカー→ツールチップへマウスを移動しても閉じない挙動になる。
// (カーソル追従+クリックでピン留め型は useCursorTooltip を使う。)
export function useAnchorTooltip<T>() {
  const [tooltip, setTooltip] = useState<T | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const open = (state: T) => {
    cancelClose();
    setTooltip(state);
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setTooltip(null), CLOSE_DELAY);
  };

  const close = () => {
    cancelClose();
    setTooltip(null);
  };

  return { tooltip, open, cancelClose, scheduleClose, close };
}
