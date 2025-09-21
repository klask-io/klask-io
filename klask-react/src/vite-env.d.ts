/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_APP_TITLE: string
  // add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Add NodeJS global declarations for compatibility
declare namespace NodeJS {
  interface ProcessEnv {
    readonly NODE_ENV: 'development' | 'production' | 'test'
  }
  interface Timeout {}
  interface Timer {}
}

declare var process: {
  readonly env: NodeJS.ProcessEnv
}
