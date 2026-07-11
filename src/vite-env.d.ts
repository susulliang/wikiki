/// <reference types="vite/client" />

declare module '*.wasm?url' {
  const src: string;
  export default src;
}

declare module 'sql.js/dist/sql-wasm.wasm?url' {
  const src: string;
  export default src;
}

/** App version injected at build time from package.json (see vite.config.ts). */
declare const __APP_VERSION__: string;
