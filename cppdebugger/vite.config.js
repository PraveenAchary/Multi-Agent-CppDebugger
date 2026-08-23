import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // 👈 Fixed the typo here!

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://multi-agent-cppdebugger.onrender.com', // Your Django backend port
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
