import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { reiniciarCore, servidor } from './servidor';
import { sockets } from './socket';

// El socket de notificaciones de CORE se simula: ver test/socket.ts
vi.mock('socket.io-client', () => import('./socket'));

beforeAll(() => servidor.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  servidor.resetHandlers();
  reiniciarCore();
  sockets.length = 0;
});
afterAll(() => servidor.close());
