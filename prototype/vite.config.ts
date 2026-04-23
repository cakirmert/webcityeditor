import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
  resolve: {
    // Critical: cityjson-threejs-loader ships its own copy of three via the file:
    // protocol. Without dedupe, Three.js objects constructed inside the loader are
    // instances of a different THREE.* class than the ones in our app, which silently
    // breaks raycasting, scene.add, and bounding-box math. Dedupe forces a single
    // THREE instance across the whole bundle.
    dedupe: ['three'],
  },
  optimizeDeps: {
    // EXCLUDE rather than include: pre-bundling the loader into node_modules/.vite
    // rewrites its import.meta.url, breaking `new Worker(new URL(...), import.meta.url)`
    // in CityJSONWorkerParser and confusing resolution of its deep imports. Serving
    // the loader's source files directly (via file: link) preserves the relative paths.
    exclude: ['cityjson-threejs-loader'],
  },
});
