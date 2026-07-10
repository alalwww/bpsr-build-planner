const LAST_SEEN_KEY = 'bpsr-changelog-last-seen-v1';

export function getLastSeenVersion(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

export function markChangelogSeen(version: string): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, version);
  } catch {
    // localStorageが使えない環境では既読管理を諦めるだけで、機能自体は動作させる
  }
}

export function hasUnreadChangelog(latestVersion: string | undefined): boolean {
  if (!latestVersion) return false;
  return getLastSeenVersion() !== latestVersion;
}
