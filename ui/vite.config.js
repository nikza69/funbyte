import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// dev: `npm run dev` (port 5173) forwards /api calls to the Express server on 3000.
// build: `npm run build` writes the finished site into ../public, which Express already serves.
export default defineConfig({
  plugins: [vue()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
  build: { outDir: '../public', emptyOutDir: false },
})
