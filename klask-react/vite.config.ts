/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Bundle syntax highlighter core separately
          'syntax-highlighter': [
            'react-syntax-highlighter/dist/esm/prism',
          ],
          // Bundle common languages together - removed individual imports since we handle them dynamically
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['react-window', '@headlessui/react', '@heroicons/react'],
          // Bundle styles together
          'syntax-styles': [
            'react-syntax-highlighter/dist/esm/styles/prism/one-light',
            'react-syntax-highlighter/dist/esm/styles/prism/one-dark',
            'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: [
      'react-syntax-highlighter/dist/esm/prism',
      'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus',
      'react-syntax-highlighter/dist/esm/styles/prism/one-light',
      'react-syntax-highlighter/dist/esm/styles/prism/one-dark',
      'react-window',
    ],
    exclude: [
      // Exclude individual language modules from pre-bundling
      // to prevent creating many small chunks
      'react-syntax-highlighter/dist/esm/languages/prism/*',
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
