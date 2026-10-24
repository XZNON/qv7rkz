import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In development the FastAPI backend runs separately on port 8000.
    proxy: { '/api': 'http://localhost:8000' },
  },
})
