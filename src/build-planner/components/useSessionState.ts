import { useCallback, useSyncExternalStore } from 'react';

// モジュールスコープの汎用ストア(コンポーネントのマウント/アンマウントをまたいで値を保持)。
// localStorage等へは永続化せず、ページを開いている間(リロードまで)だけ有効。
const store = new Map<string, unknown>();
// キーごとの購読者(useSyncExternalStoreのonStoreChange)。setSessionValue等、フックの外から
// storeを書き換えた場合でも、そのキーを表示中のコンポーネントへ即座に再レンダーさせるために使う
// (例: プランロード時に talentTree.locked を直接書き換えても、アビリティツリーが表示された
// ままだった場合に表示側のロック状態を追従させる)。
const listeners = new Map<string, Set<() => void>>();

function notify(key: string): void {
  for (const listener of listeners.get(key) ?? []) listener();
}

// useSyncExternalStoreのsubscribe実装を、フックの外からも直接テストできるよう切り出したもの。
export function subscribeSessionValue(key: string, onChange: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(onChange);
  return () => set!.delete(onChange);
}

// storeへの書き込みをReactのsetState更新関数の外(=呼び出し即時)で行う。setValueの
// 更新関数内に書き込みを入れると、コンポーネント自身のアンマウント中クリーンアップから
// 呼んだ場合にReactがそのfiber向けの更新を握りつぶし、更新関数自体が実行されずstoreへの
// 書き込みも起きない不具合になる(例: アビリティツリーの「離脱時に自動ロック」処理)。
// prevもReactのローカルstateではなくstore側から読むことで、setValueの成否に関わらず
// storeを正として一貫させる。
export function resolveSessionValue<T>(
  key: string,
  next: T | ((prev: T) => T),
  initialValue: T,
): T {
  const prev = store.has(key) ? (store.get(key) as T) : initialValue;
  const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next;
  store.set(key, resolved);
  notify(key);
  return resolved;
}

// ダイアログの開閉のたびに再マウントされて消えてほしくないが、プランの一部として保存する
// ほどでもないUI状態(絞り込みの開閉状態等)に使う。同じkeyを使う限り、別コンポーネント
// インスタンス(例: 別部位の装備選択ダイアログ)間でも値を共有する。
// useSyncExternalStoreでstoreを購読するため、setSessionValueによる外部からの書き換えも
// マウント中のインスタンスへ即座に反映される。
export function useSessionState<T>(
  key: string,
  initialValue: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeSessionValue(key, onStoreChange),
    [key],
  );
  // initialValueはuseStateの遅延初期値と同様、storeが未書き込みの間だけ参照する意図。
  // 呼び出し側で変わっても追従させないため、意図的に依存配列から外している。
  const getSnapshot = useCallback(
    () => (store.has(key) ? (store.get(key) as T) : initialValue),
    [key], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const value = useSyncExternalStore(subscribe, getSnapshot);
  // useState同様、関数(前の値を受け取る更新関数)も直接値も両方受け付ける。initialValueを
  // 依存配列から外す理由はgetSnapshotと同様。
  const setAndStore = useCallback(
    (next: T | ((prev: T) => T)) => {
      resolveSessionValue(key, next, initialValue);
    },
    [key], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return [value, setAndStore];
}

// useSessionStateを使わない箇所(Zustandストアのアクション内等)から、次回マウント時の
// 初期値としてセッションストアへ書き込むための非フック版セッター。マウント中のインスタンスが
// あればuseSyncExternalStoreの購読経由で即座に反映され、無ければ次回マウント時に読まれる。
export function setSessionValue<T>(key: string, value: T): void {
  store.set(key, value);
  notify(key);
}
