import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { mainHtmlInput, sharedDefine, sharedPlugins } from './vite.config.base';

// Tauri expects a fixed dev server port and ignores src-tauri for HMR watch.
// https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: sharedPlugins,
  clearScreen: false,
  define: sharedDefine,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: mainHtmlInput,
        settings: fileURLToPath(new URL('./settings.html', import.meta.url)),
        about: fileURLToPath(new URL('./about.html', import.meta.url)),
        'stats-detail': fileURLToPath(new URL('./stats-detail.html', import.meta.url)),
        'ability-score': fileURLToPath(new URL('./ability-score.html', import.meta.url)),
      },
    },
  },
});
