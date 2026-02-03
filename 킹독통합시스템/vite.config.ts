import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {
      API_KEY: JSON.stringify("AIzaSyD958WbuVTIul9NkgfMT50PCd3qpjo91xk")
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})