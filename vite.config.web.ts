import { defineConfig, type Plugin } from 'vite';
import { mainHtmlInput, sharedDefine, sharedPlugins } from './vite.config.base';

const GA_MEASUREMENT_ID = 'G-83Q8TXMGMY';

// Web版ビルド(dist-web/)にのみGoogle Analyticsタグを注入する。
// index.htmlはTauriデスクトップ版のエントリも兼ねているため直接タグを書かず、
// ビルド時にこのプラグインで注入することでデスクトップ版/devサーバーへの混入を防ぐ。
function googleAnalyticsPlugin(measurementId: string): Plugin {
  return {
    name: 'inject-google-analytics',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { async: true, src: `https://www.googletagmanager.com/gtag/js?id=${measurementId}` },
          injectTo: 'head',
        },
        {
          tag: 'script',
          children: [
            "window.dataLayer = window.dataLayer || [];",
            'function gtag(){dataLayer.push(arguments);}',
            "gtag('js', new Date());",
            `gtag('config', '${measurementId}');`,
          ].join('\n'),
          injectTo: 'head',
        },
      ];
    },
  };
}

// Web build target (e.g. GitHub Pages). Unlike vite.config.ts (Tauri target),
// this emits only index.html - the settings UI is shown as an inline overlay
// on the web (see src/App.tsx), not a separate native window/page.
export default defineConfig({
  plugins: [...sharedPlugins, googleAnalyticsPlugin(GA_MEASUREMENT_ID)],
  base: process.env.GITHUB_PAGES_BASE ?? '/',
  define: sharedDefine,
  build: {
    outDir: 'dist-web',
    rollupOptions: {
      input: {
        main: mainHtmlInput,
      },
    },
  },
});
