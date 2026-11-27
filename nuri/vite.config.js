import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// npm run build:pages: the full-quality page for GitHub Pages (public/play.html, next to the original assets it loads;
// no copy of public/ is made for it)
const pages = process.env.VITE_ASSETS === 'full';
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 8000, assetsInlineLimit: 100000000, copyPublicDir: !pages },
});
