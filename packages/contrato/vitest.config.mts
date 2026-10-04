import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'contrato', include: ['src/**/*.test.ts'] },
});
