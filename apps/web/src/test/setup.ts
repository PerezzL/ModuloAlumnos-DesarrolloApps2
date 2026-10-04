import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { reiniciarCore, servidor } from './servidor';

beforeAll(() => servidor.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  servidor.resetHandlers();
  reiniciarCore();
});
afterAll(() => servidor.close());
