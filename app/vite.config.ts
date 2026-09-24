import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
      '/run-files': 'http://localhost:8787',
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'server/**/*.test.ts',
      'shared/**/*.test.ts',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],
  },
})
