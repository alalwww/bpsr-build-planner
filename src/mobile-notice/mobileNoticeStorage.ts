const DISMISS_KEY = 'bpsr-mobile-notice-dismissed-at';
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000;

export function isMobileNoticeDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) return false;
    return Date.now() - dismissedAt < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

export function dismissMobileNotice(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // localStorageが使えない環境では毎回表示されるだけで、機能自体には支障はない
  }
}
