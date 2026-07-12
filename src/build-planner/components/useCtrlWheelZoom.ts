import { useCallback, useEffect, useState } from 'react';

// Ctrl+ホイールで拡大縮小するズーム状態。返り値の ref を対象要素(スクロール領域)に付ける。
// PhantomPanel(心相投影ツリー)と TalentTreePanel(アビリティツリー)で共通利用する。
//
// ref は useRef ではなく callback ref + state で要素を追跡する。対象要素が条件付き
// レンダリング(例: PhantomPanel のツリー領域はテンプレート選択後に初めてマウントされる)
// でも、要素の出現/消滅に追従してリスナーを登録し直すため。
export function useCtrlWheelZoom(options: { min: number; max: number; step: number }) {
  const { min, max, step } = options;
  const [zoom, setZoom] = useState(1.0);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const ref = useCallback((node: HTMLDivElement | null) => setEl(node), []);

  useEffect(() => {
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((prev) =>
        Math.max(min, Math.min(max, parseFloat((prev + (e.deltaY < 0 ? step : -step)).toFixed(1)))),
      );
    };
    // ブラウザ既定のページズームを抑止するため passive: false で登録する
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [el, min, max, step]);

  return { zoom, setZoom, ref };
}
