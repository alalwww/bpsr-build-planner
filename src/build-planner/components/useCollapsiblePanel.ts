import { useState } from 'react';
import { MOBILE_MAX_WIDTH } from './useMediaQuery';

// 保存済みの選択があればそれを優先し、初回訪問時はスマートフォン幅であれば
// 既定で折りたたんでおく(横並びペインが極端に狭くなるのを避けるため)。
function readInitial(key: string): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) return raw === '1';
  } catch {
    // localStorageが使えない環境では画面幅だけで判断する
  }
  return window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;
}

function persist(key: string, collapsed: boolean): void {
  try {
    localStorage.setItem(key, collapsed ? '1' : '0');
  } catch {
    // 保存できなくても、今回の表示切り替え自体には支障はない
  }
}

// 開閉可能な横並びペイン(キャラクターパネル・心相投影パネルの右ペイン等)の共通状態。
// PC版でも任意に使える汎用のUI設定として、ビルドプラン本体とは別にkeyごとに
// localStorageへ永続化する(プランの一部として保存・共有はしない)。
// 第3戻り値のopenは、他の操作(ツリーのノードタップ等)に連動して強制的に開きたい
// 場合に使う(既に開いていれば何もしない)。
export function useCollapsiblePanel(key: string): [boolean, () => void, () => void] {
  const [collapsed, setCollapsed] = useState(() => readInitial(key));

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      persist(key, next);
      return next;
    });
  };

  const open = () => {
    setCollapsed((prev) => {
      if (!prev) return prev;
      persist(key, false);
      return false;
    });
  };

  return [collapsed, toggle, open];
}
