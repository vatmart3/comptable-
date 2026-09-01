import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts'],
      exclude: [
        'src/engine/**/*.test.ts',
        'src/engine/fixtures/**',
        'src/engine/**/index.ts',
        // Déclarations de types : aucune instruction à exécuter.
        'src/engine/types/{compte,dossier,journal,piece,entrainement}.ts',
      ],
      reporter: ['text-summary'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
})
