import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // The app deliberately ships lazy-loaded GIS/3D/WASM vendor bundles
    // (notably web-ifc). Keep the warning budget aligned with those known
    // chunks after manual splitting, instead of Rollup's generic 500 kB web
    // app default.
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (!normalized.includes('/node_modules/')) return undefined;

          if (normalized.includes('/web-ifc/')) return 'vendor-web-ifc';
          if (normalized.includes('/osm2streets-js/')) return 'vendor-osm2streets';
          if (normalized.includes('/cityjson-threejs-loader/')) return 'vendor-cityjson-loader';
          if (normalized.includes('/three/')) return 'vendor-three';
          if (normalized.includes('/@deck.gl/core/')) return 'vendor-deck-core';
          if (normalized.includes('/@deck.gl/layers/')) return 'vendor-deck-layers';
          if (normalized.includes('/@deck.gl/mapbox/')) return 'vendor-deck-mapbox';
          if (normalized.includes('/@deck.gl/mesh-layers/')) return 'vendor-deck-mesh';
          if (normalized.includes('/@deck.gl/')) return 'vendor-deck';
          if (normalized.includes('/@luma.gl/')) return 'vendor-luma';
          if (normalized.includes('/@math.gl/')) return 'vendor-math';
          if (normalized.includes('/@loaders.gl/')) return 'vendor-loaders';
          if (normalized.includes('/maplibre-gl/')) return 'vendor-maplibre';
          if (normalized.includes('/terra-draw')) return 'vendor-terra-draw';
          if (
            normalized.includes('/react/') ||
            normalized.includes('/react-dom/') ||
            normalized.includes('/scheduler/') ||
            normalized.includes('/lucide-react/')
          ) {
            return 'vendor-react';
          }
          if (normalized.includes('/proj4/')) return 'vendor-projection';
          if (normalized.includes('/@radix-ui/')) return 'vendor-radix';

          return undefined;
        },
      },
    },
  },
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
