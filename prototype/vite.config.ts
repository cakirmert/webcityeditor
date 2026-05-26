import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
  resolve: {
    // Critical: keep CityJSON loader and app meshes on the same Three.js
    // instance. Without dedupe, objects constructed inside the loader can come
    // from a different THREE.* class than the app's raycaster/scene utilities.
    dedupe: ['three'],
  },
  optimizeDeps: {
    // EXCLUDE rather than include: pre-bundling the loader into node_modules/.vite
    // rewrites its import.meta.url, breaking `new Worker(new URL(...), import.meta.url)`
    // in CityJSONWorkerParser and confusing resolution of its deep imports. Let
    // Vite serve the pinned package source files directly.
    exclude: ['cityjson-threejs-loader'],
  },
});
