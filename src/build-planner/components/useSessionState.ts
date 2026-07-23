import { useState } from 'react';

// モジュールスコープの汎用ストア(コンポーネントのマウント/アンマウントをまたいで値を保持)。
// localStorage等へは永続化せず、ページを開いている間(リロードまで)だけ有効。
const store = new Map<string, unknown>();

// ダイアログの開閉のたびに再マウントされて消えてほしくないが、プランの一部として保存する
// ほどでもないUI状態(絞り込みの開閉状態等)に使う。同じkeyを使う限り、別コンポーネント
// インスタンス(例: 別部位の装備選択ダイアログ)間でも値を共有する。
export function useSessionState<T>(
  key: string,
  initialValue: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() =>
    store.has(key) ? (store.get(key) as T) : initialValue,
  );
  // useState同様、関数(前の値を受け取る更新関数)も直接値も両方受け付ける。
  const setAndStore = (next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next;
      store.set(key, resolved);
      return resolved;
    });
  };
  return [value, setAndStore];
}
