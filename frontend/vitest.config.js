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
    include: ['tests/**/*.spec.js'],
    globals: false,
    setupFiles: ['./tests/setup.js']
  }
})
