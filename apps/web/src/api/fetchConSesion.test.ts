import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { Sesion } from '@/sesion/sesion';
import { BFF, core, reiniciarCore, servidor } from '@/test/servidor';
import { crearFetchConSesion } from './fetchConSesion';

describe('fetchConSesion', () => {
  it('con varios pedidos que fallan con 401 a la vez, hace un único refresh y los repite', async () => {
    reiniciarCore(true);
    const sesion = new Sesion();
    await sesion.iniciarSesion('v.moreno@uade.edu.ar', 'uade2026');
    const vistos: string[] = [];
    servidor.use(
      http.get(`${BFF}/cursadas`, ({ request }) => {
        const auth = request.headers.get('authorization') ?? '';
        vistos.push(auth);
        // El token del login "venció": solo sirve el refrescado
        return auth.startsWith('Bearer token-refrescado')
          ? HttpResponse.json({ items: [] })
          : HttpResponse.json({ code: 'AUTH_TOKEN_INVALID' }, { status: 401 });
      }),
    );
    const fetchConSesion = crearFetchConSesion(() => sesion);

    const respuestas = await Promise.all(
      [1, 2, 3].map(() => fetchConSesion(new Request(`${BFF}/cursadas`))),
    );

    expect(respuestas.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(core.refreshes).toBe(1);
    expect(vistos.filter((a) => a === 'Bearer token-refrescado-1')).toHaveLength(3);
  });

  it('repite el pedido una sola vez', async () => {
    reiniciarCore(true);
    const sesion = new Sesion();
    await sesion.iniciarSesion('v.moreno@uade.edu.ar', 'uade2026');
    let llamadas = 0;
    servidor.use(
      http.get(`${BFF}/cursadas`, () => {
        llamadas++;
        return HttpResponse.json({}, { status: 401 });
      }),
    );

    const res = await crearFetchConSesion(() => sesion)(new Request(`${BFF}/cursadas`));

    expect(res.status).toBe(401);
    expect(llamadas).toBe(2);
  });

  it('si el refresh falla, la sesión termina', async () => {
    reiniciarCore(true);
    const sesion = new Sesion();
    await sesion.iniciarSesion('v.moreno@uade.edu.ar', 'uade2026');
    core.cookieValida = false;
    servidor.use(http.get(`${BFF}/cursadas`, () => HttpResponse.json({}, { status: 401 })));

    await crearFetchConSesion(() => sesion)(new Request(`${BFF}/cursadas`));

    expect(sesion.obtenerEstado()).toEqual({ tipo: 'anonimo' });
    expect(sesion.token()).toBeNull();
  });
});
