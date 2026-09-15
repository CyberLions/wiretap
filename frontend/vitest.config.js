import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Test-only config: the app's vite.config.js pulls in devtools/jsx/svg plugins
// that the component tests do not need.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom',
    // Production serves Wiretap over HTTPS, and some console behavior keys off
    // the page scheme, so tests run on an HTTPS origin by default.
    environmentOptions: {
      jsdom: { url: 'https://wiretap.test/' }
    },
    include: ['tests/**/*.spec.js'],
    globals: false,
    setupFiles: ['./tests/setup.js']
  }
})
