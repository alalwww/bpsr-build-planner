import { useEffect } from 'react';

// App.cssの#root paddingと同じブレークポイント。スマホの横画面のみ対象にする。
const LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 500px)';

// スマホ横画面では、下にスクロールしてアドレスバーが隠れてもタブ等の操作要素が
// 画面最上端に近づきすぎないよう #root に上部余白(padding-top)を確保している
// (App.css参照)。この余白は開いた直後・画面回転直後には無駄な空白として
// 目に入ってしまうため、その瞬間だけ自動的にスクロールして飛ばし、コンテンツの
// 左上をビューポート上端に合わせる。余白の値はCSS側で再定義せず、実際に
// 適用されているcomputed styleを読んで追従させる。
export function useScrollToContentOnLandscape(): void {
  useEffect(() => {
    const mql = window.matchMedia(LANDSCAPE_QUERY);
    const scrollToContentTop = () => {
      if (!mql.matches) return;
      const root = document.getElementById('root');
      if (!root) return;
      const paddingTop = parseFloat(getComputedStyle(root).paddingTop) || 0;
      if (paddingTop <= 0) return;
      window.scrollTo({ top: paddingTop });
    };
    scrollToContentTop();
    mql.addEventListener('change', scrollToContentTop);
    window.addEventListener('orientationchange', scrollToContentTop);
    return () => {
      mql.removeEventListener('change', scrollToContentTop);
      window.removeEventListener('orientationchange', scrollToContentTop);
    };
  }, []);
}
