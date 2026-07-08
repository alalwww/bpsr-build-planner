import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

// vite.config.ts(Tauriデスクトップ向け)とvite.config.web.ts(Web/GitHub Pages向け)の
// 両方で共通の設定(reactプラグイン、__APP_VERSION__/__BUILD_TIME__のdefine、
// index.htmlのビルドエントリ)をここに一元化する。

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
);

export const sharedPlugins = [react()];

export const sharedDefine = {
  __APP_VERSION__: JSON.stringify(process.env.VITE_RELEASE_TAG ?? `v${pkg.version}`),
  __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
};

export const mainHtmlInput = fileURLToPath(new URL('./index.html', import.meta.url));
