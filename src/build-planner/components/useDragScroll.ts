import { useCallback, useEffect, useRef, useState } from 'react';

// 背景部分をドラッグしてスクロールできるようにするフック。返り値の ref を対象要素
// (overflow:auto のスクロールコンテナ)に付ける。PhantomPanel(潜在ツリー)と
// TalentTreePanel(アビリティツリー)で共通利用する。
//
// nodeSelector に一致する要素(ノードのクリック領域)の内側で mousedown した場合は
// ドラッグを開始せず、通常のクリックとして扱う(誤って背景ドラッグと衝突しないため)。
//
// ref は useCtrlWheelZoom と同様、useRef ではなく callback ref + state で要素を追跡する
// (対象要素が条件付きレンダリングでも出現/消滅に追従してリスナーを登録し直すため)。
export function useDragScroll(nodeSelector: string) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const ref = useCallback((node: HTMLElement | null) => setEl(node), []);
  const dragging = useRef(false);
  const start = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  useEffect(() => {
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest(nodeSelector)) return;
      dragging.current = true;
      start.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: el.scrollLeft,
        scrollTop: el.scrollTop,
      };
      el.style.cursor = 'grabbing';
      // テキスト選択・画像のネイティブドラッグ操作が始まってしまうのを防ぐ。
      e.preventDefault();
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      el.scrollLeft = start.current.scrollLeft - (e.clientX - start.current.x);
      el.scrollTop = start.current.scrollTop - (e.clientY - start.current.y);
    };
    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      el.style.cursor = '';
    };

    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      el.style.cursor = '';
    };
  }, [el, nodeSelector]);

  return { ref };
}
