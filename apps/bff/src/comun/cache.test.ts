import { describe, expect, it, vi } from 'vitest';
import { CacheTtl } from './cache';

describe('CacheTtl', () => {
  it('dentro del TTL no vuelve a cargar; vencido, sí', async () => {
    let ahora = 0;
    const cache = new CacheTtl<string>(1000, () => ahora);
    const cargar = vi.fn().mockResolvedValue('v');
    await cache.obtener('a', cargar);
    ahora = 999;
    expect(await cache.obtener('a', cargar)).toBe('v');
    expect(cargar).toHaveBeenCalledTimes(1);
    ahora = 1000;
    await cache.obtener('a', cargar);
    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it('cada clave se cachea por separado', async () => {
    const cache = new CacheTtl<string>(1000);
    expect(await cache.obtener('a', () => Promise.resolve('A'))).toBe('A');
    expect(await cache.obtener('b', () => Promise.resolve('B'))).toBe('B');
  });

  it('un error no se cachea', async () => {
    const cache = new CacheTtl<string>(1000);
    await expect(cache.obtener('a', () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect(await cache.obtener('a', () => Promise.resolve('ok'))).toBe('ok');
  });
});
