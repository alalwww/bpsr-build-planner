import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'));

// Web build target (e.g. GitHub Pages). Unlike vite.config.ts (Tauri target),
// this emits only index.html - the settings UI is shown as an inline overlay
// on the web (see src/App.tsx), not a separate native window/page.
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES_BASE ?? '/',
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VITE_RELEASE_TAG ?? `v${pkg.version}`),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    outDir: 'dist-web',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
      },
    },
  },
});
