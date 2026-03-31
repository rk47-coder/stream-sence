import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Backend base URL in dev (must match `PORT` in backend `.env`). ECONNREFUSED = API not running. */
const apiTarget = process.env.VITE_DEV_API_ORIGIN?.trim() || 'http://localhost:5050'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/socket.io': { target: apiTarget, ws: true },
    },
  },
})
