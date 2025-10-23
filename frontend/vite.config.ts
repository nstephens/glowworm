import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0', // Listen on all addresses
    allowedHosts: true, // Disable host check for reverse proxy support
    strictPort: false,
    hmr: {
      clientPort: 3003, // For reverse proxy compatibility
    },
    // Proxy API requests to backend - allows frontend to be single entry point
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:8001',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:8001',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    strictPort: false,
  },
})
