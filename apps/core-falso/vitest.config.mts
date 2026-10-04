import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'core-falso', root: import.meta.dirname, include: ['src/**/*.test.ts'] },
});
