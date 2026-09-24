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

export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
}

export function useIsPortrait(): boolean {
  return useMediaQuery('(orientation: portrait)');
}
