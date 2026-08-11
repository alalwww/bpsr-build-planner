import { describe, expect, it } from 'vitest';
import { resolveSessionValue, setSessionValue, subscribeSessionValue } from './useSessionState';

// このstoreはモジュールスコープのシングルトンなので、テスト間で汚染しないようkeyを
// テストごとに変える(useBuildStore.test.tsのようなグローバルリセット手段がないため)。

describe('resolveSessionValue', () => {
  it('storeに存在しないkeyはinitialValueを起点にresolveする', () => {
    const resolved = resolveSessionValue('test.fresh', (prev: number) => prev + 1, 10);
    expect(resolved).toBe(11);
  });

  it('直接値を渡した場合はそのままstoreへ書き込む', () => {
    resolveSessionValue('test.direct', 1, 0);
    const resolved = resolveSessionValue('test.direct', 5, 0);
    expect(resolved).toBe(5);
  });

  it('関数を渡した場合、Reactのlocal state(useState)ではなくstore側の最新値をprevとして使う', () => {
    // setSessionValue はReactのuseState(setValue)を経由せずstoreだけを直接書き換える。
    // resolveSessionValue の prev がここで書いた値を拾えることは、React側のsetValueが
    // 何らかの理由で更新に反映されなかった(=local stateがstoreより古い)場合でも、
    // 次の呼び出しが正しい値を起点にresolveできることを意味する。
    // これはTalentTreePanelの「離脱時に全ポイント消費済みなら自動ロック」処理が、
    // コンポーネント自身のアンマウント中クリーンアップからsetterを呼ぶケースの安全性の要。
    // Reactはアンマウント中のfiber向けのsetState更新を握りつぶす(setValueの更新関数自体が
    // 実行されない)ため、store書き込みをsetValueの更新関数の中に置くと書き込みごと消えてしまう。
    setSessionValue('test.external-write', 100);
    const resolved = resolveSessionValue('test.external-write', (prev: number) => prev + 1, 0);
    expect(resolved).toBe(101);
  });
});

describe('setSessionValue', () => {
  it('storeへ直接書き込み、以後のresolveSessionValueのprevに反映される', () => {
    setSessionValue('test.set-session-value', 42);
    expect(resolveSessionValue('test.set-session-value', (prev: number) => prev, 0)).toBe(42);
  });

  it('購読中のリスナーへ通知する(useSyncExternalStore経由でマウント中コンポーネントを再レンダーさせる土台)', () => {
    // アビリティツリーを表示したままプランをロードすると、applyPlanStateがsetSessionValueで
    // talentTree.lockedを直接書き換える。TalentTreePanelがuseSyncExternalStoreでこのkeyを
    // 購読していれば、ここで通知が届いて即座にロック表示へ再レンダーされる必要がある。
    let notified = 0;
    const unsubscribe = subscribeSessionValue('test.subscribe', () => {
      notified += 1;
    });

    setSessionValue('test.subscribe', 'a');
    expect(notified).toBe(1);

    resolveSessionValue('test.subscribe', 'b', '');
    expect(notified).toBe(2);

    unsubscribe();
    setSessionValue('test.subscribe', 'c');
    expect(notified).toBe(2); // unsubscribe後は通知されない(アンマウント後の余計な再レンダー防止)
  });
});
