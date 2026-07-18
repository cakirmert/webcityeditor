/// <reference types="vite/client" />

// `?url` imports — Vite resolves these to the final asset URL string. Used
// for shipping the web-ifc WASM blob alongside the bundle.
declare module '*.wasm?url' {
  const src: string;
  export default src;
}
