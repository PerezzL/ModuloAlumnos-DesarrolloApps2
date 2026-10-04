import { defineConfig } from 'vitest/config';

// Cada app o paquete con tests define su propio vitest.config.mts; acá solo se agrupan.
export default defineConfig({
  test: {
    projects: ['apps/*/vitest.config.mts', 'packages/*/vitest.config.mts'],
    passWithNoTests: true,
  },
});
