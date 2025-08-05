import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import svgLoader from 'vite-svg-loader'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
    svgLoader(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    port: 8080,
    host: '0.0.0.0',
    allowedHosts: ['psuccso.org','staging.psuccso.org'],
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Access-Control-Allow-Origin': '*',  
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE', 
    },
    // Improve file watching for Docker
    watch: {
      usePolling: true,
      interval: 1000,
      followSymlinks: false
    },
    // Proxy API requests to Strapi backend
    proxy: {
      '/api': {
        target: 'http://localhost:1337',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})