import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^osm2streets-js$/,
        replacement: fileURLToPath(
          new URL('./node_modules/osm2streets-js/osm2streets_js.js', import.meta.url)
        ),
      },
      {
        find: /^osm2streets-js\/osm2streets_js_bg\.wasm\?url$/,
        replacement: `${fileURLToPath(
          new URL('./vendor/osm2streets-js/osm2streets_js_bg.wasm', import.meta.url)
        )}?url`,
      },
      {
        find: /^osm2streets-js\/osm2streets_js_bg\.wasm$/,
        replacement: fileURLToPath(
          new URL('./node_modules/osm2streets-js/osm2streets_js_bg.wasm', import.meta.url)
        ),
      },
    ],
    dedupe: ['three'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
  },
});
