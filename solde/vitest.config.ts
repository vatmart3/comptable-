import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    setupFiles: ['tests/setup/env.ts'],
    // Les tests d'intégration partagent une base : pas de parallélisme entre
    // fichiers, sinon deux suites se marchent dessus sur la même société.
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
})
