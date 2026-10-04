import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC emite la metadata de decoradores que Nest necesita para la inyección de dependencias
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    name: 'bff',
    root: import.meta.dirname,
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
