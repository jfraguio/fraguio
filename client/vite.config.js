import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3123,
    proxy: {
      '/api': {
        target: 'http://localhost:3124',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  }
})
