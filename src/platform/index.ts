// Tauri v2 injects this global into the webview at runtime, so checking for
// its presence lets the same component code adapt to desktop (Tauri) vs.
// plain-browser (web) environments without a build-time flag.
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
