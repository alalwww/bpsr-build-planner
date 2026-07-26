import { useEffect, useState } from 'react';

// active が false になった直後も durationMs の間だけ true を返し続ける。ドロップダウン等の
// 開閉パネルで、閉じる瞬間に退出アニメーション(CSS animationのdropdown-panel-anim--closing)
// を再生してからDOMアンマウントするために使う(即座にアンマウントすると退出アニメーションが
// 再生されない)。durationMsはCSS側のアニメーション時間と一致させること。
export function useDelayedUnmount(active: boolean, durationMs: number): boolean {
  const [mounted, setMounted] = useState(active);

  useEffect(() => {
    if (active) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    const timer = setTimeout(() => setMounted(false), durationMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, durationMs]);

  return mounted;
}
