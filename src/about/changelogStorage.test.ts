import { beforeEach, describe, expect, it, vi } from 'vitest';

// vitestは environment: 'node' で動作しており、node には localStorage が存在しないため
// autosave.test.ts と同様の簡易 polyfill をグローバルへ差し込む。
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number) {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

vi.stubGlobal('localStorage', new MemoryStorage());

const { getLastSeenVersion, markChangelogSeen, hasUnreadChangelog } =
  await import('./changelogStorage');

describe('changelogStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('未読の場合はhasUnreadChangelogがtrueを返す', () => {
    expect(getLastSeenVersion()).toBeNull();
    expect(hasUnreadChangelog('0.3.0')).toBe(true);
  });

  it('markChangelogSeenで既読にすると同一バージョンではfalseになる', () => {
    markChangelogSeen('0.3.0');
    expect(getLastSeenVersion()).toBe('0.3.0');
    expect(hasUnreadChangelog('0.3.0')).toBe(false);
  });

  it('既読バージョンより新しいバージョンが出るとまた未読になる', () => {
    markChangelogSeen('0.3.0');
    expect(hasUnreadChangelog('0.3.1')).toBe(true);
  });

  it('latestVersionが未定義の場合は常にfalse', () => {
    expect(hasUnreadChangelog(undefined)).toBe(false);
  });
});
