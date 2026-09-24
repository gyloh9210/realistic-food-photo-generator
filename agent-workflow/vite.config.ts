import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = env.AGENT_WORKFLOW_PORT || '3001'
  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_AGENT_WORKFLOW_PORT || 5174),
      proxy: {
        '/api': `http://localhost:${apiPort}`,
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
  }
})
