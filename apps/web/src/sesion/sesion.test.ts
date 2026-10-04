import { describe, expect, it, vi } from 'vitest';
import { reiniciarCore } from '@/test/servidor';
import { Sesion } from './sesion';

describe('Sesion', () => {
  it('al abrir la app recupera la sesión con la cookie de refresh', async () => {
    reiniciarCore(true);
    const sesion = new Sesion();
    await sesion.iniciar();
    expect(sesion.obtenerEstado()).toMatchObject({
      tipo: 'autenticado',
      usuario: { email: 'v.moreno@uade.edu.ar' },
    });
    expect(sesion.token()).toBe('token-refrescado-1');
  });

  it('sin cookie de refresh queda anónima', async () => {
    const sesion = new Sesion();
    await sesion.iniciar();
    expect(sesion.obtenerEstado()).toEqual({ tipo: 'anonimo' });
  });

  it('el token nunca se guarda en localStorage ni en sessionStorage', async () => {
    // localStorage y sessionStorage comparten Storage.prototype
    const guardar = vi.spyOn(Storage.prototype, 'setItem');
    const sesion = new Sesion();
    await sesion.iniciarSesion('v.moreno@uade.edu.ar', 'uade2026');
    await sesion.refrescar();
    expect(sesion.token()).toBeTruthy();
    expect(guardar).not.toHaveBeenCalled();
    guardar.mockRestore();
  });
});
