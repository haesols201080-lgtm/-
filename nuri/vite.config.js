import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 8000, assetsInlineLimit: 100000000 },
});
