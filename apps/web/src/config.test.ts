import { describe, expect, it } from 'vitest';
import { baseAuth } from './config';

describe('base de las llamadas de auth', () => {
  it('sin reenvío va al Gateway', () => {
    expect(baseAuth('https://gateway.test', undefined)).toBe('https://gateway.test');
    expect(baseAuth('https://gateway.test', 'false')).toBe('https://gateway.test');
  });

  it('con VITE_AUTH_PROXY=true va al propio origen del portal', () => {
    expect(baseAuth('https://gateway.test', 'true')).toBe('');
  });
});
