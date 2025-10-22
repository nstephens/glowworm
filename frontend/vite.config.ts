import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Listen on all addresses
    allowedHosts: true, // Disable host check for reverse proxy support
    strictPort: false,
    hmr: {
      clientPort: 3003, // For reverse proxy compatibility
    },
  },
  preview: {
    host: '0.0.0.0',
    strictPort: false,
  },
})
