import { defineConfig } from 'vite';
import { mainHtmlInput, sharedDefine, sharedPlugins } from './vite.config.base';

// Web build target (e.g. GitHub Pages). Unlike vite.config.ts (Tauri target),
// this emits only index.html - the settings UI is shown as an inline overlay
// on the web (see src/App.tsx), not a separate native window/page.
export default defineConfig({
  plugins: sharedPlugins,
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
