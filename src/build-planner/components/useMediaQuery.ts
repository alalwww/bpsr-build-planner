import { useEffect, useState } from 'react';

// window.matchMedia を購読する汎用フック。リサイズ・画面回転(向き変更)にも追従する。
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// PC版サイトの利用を推奨するお知らせ表示等の判定に使う、スマートフォン相当の画面幅。
// build-planner.css側のレイアウト崩れ対応(横スクロール許容・タップ領域拡大)の
// ブレークポイントとも揃える。
export const MOBILE_MAX_WIDTH = 767;
// 横画面時の判定用。縦画面時の幅がそのまま横画面の高さになる一方、縦画面時の高さが
// 横画面の幅になり MOBILE_MAX_WIDTH を超える機種があるため(Pixel 6 Pro等、
// 縦412px→横915px相当)、幅だけでなく「横画面で高さが低い」ケースも対象に含める。
// CSS側の同名ブレークポイント(各CSSファイルの `@media (max-width: 767px), … ` )と揃える。
export const MOBILE_MAX_HEIGHT_LANDSCAPE = 500;

// useIsMobile()と、matchMediaを直接読みたい非フックコード(useCollapsiblePanelの
// 初期値判定等)の両方から使う共通クエリ文字列。
export const MOBILE_QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px), (orientation: landscape) and (max-height: ${MOBILE_MAX_HEIGHT_LANDSCAPE}px)`;

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}

export function useIsPortrait(): boolean {
  return useMediaQuery('(orientation: portrait)');
}
