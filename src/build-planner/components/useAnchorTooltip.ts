import { useRef, useState } from 'react';

// ホバー解除後、この時間内にツールチップ本体へマウスが乗らなければ閉じる(ms)。
// useCursorTooltip の CLOSE_DELAY と同じ値に揃えている。
const CLOSE_DELAY = 120;

// 要素(アンカー)の矩形を基準に表示し、ホバー解除後は少し遅れて閉じるツールチップの
// 開閉状態とタイマーを共通化するフック。アンカー側は open(payload)/scheduleClose を、
// ツールチップ本体側は cancelClose/scheduleClose を onMouseEnter/onMouseLeave に渡すことで、
// アンカー→ツールチップへマウスを移動しても閉じない挙動になる。
// (カーソル追従+クリックでピン留め型は useCursorTooltip を使う。)
//
// hoverDelay(ms、既定0=即時表示)を指定すると、表示中のものと異なる対象へホバー移動した
// 場合は一旦閉じ(即座に非表示にし)、この時間ホバーし続けて初めて新しい内容を表示する
// (hover intent)。isSameState を渡すと、同一対象への再入場(closeのグレース期間中に
// 一瞬外れて戻ってきた場合等)を「切り替わっていない」とみなし、待たせずそのまま表示を
// 継続できる(省略時は毎回別対象とみなす=常に閉じてから待たせる)。
export function useAnchorTooltip<T>(hoverDelay = 0, isSameState?: (a: T, b: T) => boolean) {
  const [tooltip, setTooltip] = useState<T | null>(null);
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

  const open = (state: T) => {
    cancelClose();
    cancelOpen();
    const isSame = tooltip !== null && (isSameState?.(tooltip, state) ?? false);
    if (hoverDelay > 0 && !isSame) {
      if (tooltip !== null) setTooltip(null);
      openTimerRef.current = setTimeout(() => {
        openTimerRef.current = null;
        setTooltip(state);
      }, hoverDelay);
    } else {
      setTooltip(state);
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

  return { tooltip, open, cancelClose, scheduleClose, close };
}
