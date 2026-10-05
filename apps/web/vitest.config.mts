import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    name: 'web',
    root: import.meta.dirname,
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    env: {
      VITE_GATEWAY_URL: 'http://gateway.test',
      VITE_NOTIFICATIONS_URL: 'http://gateway.test/notifications',
      VITE_BIBLIOTECA_URL: 'https://biblioteca.test',
      VITE_EVENTOS_URL: 'https://eventos.test',
    },
  },
});
