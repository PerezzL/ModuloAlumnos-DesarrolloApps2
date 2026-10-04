import type { Calendario } from '@uadenet/api-types';
import { Contrato } from '@uadenet/contrato';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { cuerpo, prepararE2E } from './app-e2e';
import { envDePrueba } from './env';
import { fuenteCaida, fuentesConFixtures, RUTAS_CALENDARIO } from './calendario-gateway';

const contrato = new Contrato();
const OCTUBRE = '/calendario?desde=2026-10-01&hasta=2026-10-31';

describe('GET /calendario con fuentes caídas', () => {
  const e2e = prepararE2E();

  it('una fuente caída: 200 con las otras dos y la categoría marcada con su code', async () => {
    e2e.server.use(fuenteCaida('EXAMEN', 503), ...fuentesConFixtures());
    const res = await e2e.get(OCTUBRE);
    expect(res.status).toBe(200);
    expect(contrato.validar('get', '/calendario', 200, res.body).errores).toEqual([]);
    const { items, fuentes } = res.body as Calendario;
    expect(items.some((i) => i.categoria === 'EXAMEN')).toBe(false);
    expect(items.some((i) => i.categoria === 'COMEDOR')).toBe(true);
    expect(fuentes).toEqual([
      { categoria: 'COMEDOR', estado: 'OK' },
      { categoria: 'EVENTO', estado: 'OK' },
      { categoria: 'EXAMEN', estado: 'ERROR', code: 'UPSTREAM_UNAVAILABLE' },
    ]);
  });

  it('dos fuentes caídas (502 y 504): 200 con la que queda', async () => {
    e2e.server.use(
      fuenteCaida('COMEDOR', 502),
      fuenteCaida('EVENTO', 504),
      ...fuentesConFixtures(),
    );
    const res = await e2e.get(OCTUBRE);
    expect(res.status).toBe(200);
    const { items, fuentes } = res.body as Calendario;
    expect(items.map((i) => i.categoria)).toEqual(['EXAMEN']);
    expect(fuentes).toEqual([
      { categoria: 'COMEDOR', estado: 'ERROR', code: 'UPSTREAM_INVALID' },
      { categoria: 'EVENTO', estado: 'ERROR', code: 'UPSTREAM_TIMEOUT' },
      { categoria: 'EXAMEN', estado: 'OK' },
    ]);
  });

  it('una respuesta con forma inválida cuenta como falla de esa fuente', async () => {
    e2e.server.use(
      http.get(RUTAS_CALENDARIO.COMEDOR, () => HttpResponse.json({ otra: 'cosa' })),
      ...fuentesConFixtures(),
    );
    const res = await e2e.get(OCTUBRE);
    expect(res.status).toBe(200);
    expect((res.body as Calendario).fuentes[0]).toEqual({
      categoria: 'COMEDOR',
      estado: 'ERROR',
      code: 'UPSTREAM_INVALID',
    });
  });

  it('las tres caídas: 503 UPSTREAM_UNAVAILABLE con el detalle de cada una', async () => {
    e2e.server.use(
      fuenteCaida('COMEDOR', 503),
      fuenteCaida('EVENTO', 504),
      fuenteCaida('EXAMEN', 502),
    );
    const res = await e2e.get(OCTUBRE);
    expect(res.status).toBe(503);
    expect(cuerpo(res)).toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
      detail: 'COMEDOR: UPSTREAM_UNAVAILABLE; EVENTO: UPSTREAM_TIMEOUT; EXAMEN: UPSTREAM_INVALID',
    });
    expect(contrato.validar('get', '/calendario', 503, cuerpo(res)).errores).toEqual([]);
  });

  it('si la única categoría pedida falla, es 503', async () => {
    e2e.server.use(fuenteCaida('EVENTO'));
    const res = await e2e.get(`${OCTUBRE}&categorias=EVENTO`);
    expect(res.status).toBe(503);
  });

  it('una fuente lenta no demora a las otras más allá del timeout', async () => {
    const timeout = Number(envDePrueba.GATEWAY_TIMEOUT_MS);
    e2e.server.use(
      http.get(RUTAS_CALENDARIO.EVENTO, async () => {
        await delay(timeout * 10);
        return HttpResponse.json([]);
      }),
      ...fuentesConFixtures(),
    );
    const inicio = performance.now();
    const res = await e2e.get(OCTUBRE);
    const ms = performance.now() - inicio;

    expect(res.status).toBe(200);
    expect((res.body as Calendario).fuentes[1]).toEqual({
      categoria: 'EVENTO',
      estado: 'ERROR',
      code: 'UPSTREAM_TIMEOUT',
    });
    expect(ms).toBeLessThan(timeout * 3);
  });
});
