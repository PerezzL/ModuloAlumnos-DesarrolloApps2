import { Contrato } from '@uadenet/contrato';
import type { Calendario } from '@uadenet/api-types';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { cuerpo, prepararE2E } from './app-e2e';
import { fuentesConFixtures, RUTAS_CALENDARIO } from './calendario-gateway';

const contrato = new Contrato();
const OCTUBRE = '/calendario?desde=2026-10-01&hasta=2026-10-31';

describe('GET /calendario', () => {
  const e2e = prepararE2E();

  it('junta las tres fuentes ordenadas por inicio y cumple el contrato', async () => {
    e2e.server.use(...fuentesConFixtures());
    const res = await e2e.get(OCTUBRE);
    expect(res.status).toBe(200);
    expect(contrato.validar('get', '/calendario', 200, res.body).errores).toEqual([]);

    const { items, fuentes } = res.body as Calendario;
    expect(items.map((i) => i.id)).toEqual([
      'EVENTO:8b0f4e2a-3c1d-4f5e-9a6b-7c8d9e0f1a2b',
      'COMEDOR:1',
      'COMEDOR:7',
      'EVENTO:65a783d1-d407-442d-8d09-a6d2abfe9321',
      'COMEDOR:12',
      'EXAMEN:turno-2026-10',
    ]);
    const inicios = items.map((i) => Date.parse(i.inicio));
    expect(inicios).toEqual([...inicios].sort((a, b) => a - b));
    expect(fuentes).toEqual([
      { categoria: 'COMEDOR', estado: 'OK' },
      { categoria: 'EVENTO', estado: 'OK' },
      { categoria: 'EXAMEN', estado: 'OK' },
    ]);
  });

  it('pide a Eventos el rango completo, con el token del alumno', async () => {
    let pedido: Request | undefined;
    // msw usa el primer handler que coincide
    e2e.server.use(
      http.get(RUTAS_CALENDARIO.EVENTO, ({ request }) => {
        pedido = request;
        return HttpResponse.json([]);
      }),
      ...fuentesConFixtures(),
    );
    await e2e.get(OCTUBRE);
    const url = new URL(pedido!.url);
    expect(url.searchParams.get('desde')).toBe('2026-10-01T00:00:00-03:00');
    expect(url.searchParams.get('hasta')).toBe('2026-11-01T00:00:00-03:00');
    expect(pedido!.headers.get('authorization')).toBe(`Bearer ${e2e.token}`);
  });

  it.each([
    ['hasta anterior a desde', '?desde=2026-10-10&hasta=2026-10-01', 'RANGO_INVALIDO'],
    ['más de 62 días', '?desde=2026-10-01&hasta=2026-12-02', 'RANGO_INVALIDO'],
    ['sin hasta', '?desde=2026-10-01', 'SOLICITUD_INVALIDA'],
    ['fecha inexistente', '?desde=2026-02-30&hasta=2026-03-10', 'SOLICITUD_INVALIDA'],
    ['fecha con hora', '?desde=2026-10-01T00:00&hasta=2026-10-31', 'SOLICITUD_INVALIDA'],
  ])('400 con %s', async (_caso, query, code) => {
    const res = await e2e.get(`/calendario${query}`);
    expect(res.status).toBe(400);
    expect(cuerpo(res)).toMatchObject({ code });
    expect(contrato.validar('get', '/calendario', 400, cuerpo(res)).errores).toEqual([]);
  });

  it('62 días es el máximo permitido', async () => {
    e2e.server.use(...fuentesConFixtures());
    const res = await e2e.get('/calendario?desde=2026-10-01&hasta=2026-12-01');
    expect(res.status).toBe(200);
  });
});
