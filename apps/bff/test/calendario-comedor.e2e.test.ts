import type { Calendario } from '@uadenet/api-types';
import { Contrato } from '@uadenet/contrato';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { prepararE2E } from './app-e2e';
import { fuentesConFixtures, RUTA_SEDES, RUTAS_CALENDARIO } from './calendario-gateway';

const contrato = new Contrato();
const OCTUBRE = '/calendario?desde=2026-10-01&hasta=2026-10-31&categorias=COMEDOR';

// Los casos comparten la app (y su caché de sedes): el orden importa
describe('GET /calendario · turnos de comedor y sedes de Backoffice', () => {
  const e2e = prepararE2E();

  it('con Backoffice caído, los turnos salen igual sin lugar y no se cachea el error', async () => {
    e2e.server.use(
      http.get(RUTA_SEDES, () => new HttpResponse(null, { status: 503 })),
      ...fuentesConFixtures(),
    );
    const res = await e2e.get(OCTUBRE);
    expect(res.status).toBe(200);
    expect(contrato.validar('get', '/calendario', 200, res.body).errores).toEqual([]);
    const { items, fuentes } = res.body as Calendario;
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.lugar === null)).toBe(true);
    expect(fuentes).toEqual([{ categoria: 'COMEDOR', estado: 'OK' }]);
  });

  it('el lugar es el nombre de la sede, y el catálogo se pide una sola vez', async () => {
    let consultasSedes = 0;
    e2e.server.use(
      http.get(RUTA_SEDES, ({ request }) => {
        consultasSedes++;
        expect(new URL(request.url).searchParams.get('limit')).toBe('100');
        return HttpResponse.json({
          items: [
            { siteId: '3e9b0a12-55cc-4d77-9a01-6b2f8c4e1d90', name: 'Sede Monserrat' },
            { siteId: '7b1d3f5a-9c2e-4a6b-8d0f-2e4a6c8b0d12', name: 'Sede Recoleta' },
          ],
          nextCursor: null,
        });
      }),
      ...fuentesConFixtures(),
    );
    const primera = (await e2e.get(OCTUBRE)).body as Calendario;
    await e2e.get(OCTUBRE);
    expect(primera.items.map((i) => i.lugar)).toEqual([
      'Sede Monserrat',
      'Sede Monserrat',
      'Sede Recoleta',
    ]);
    expect(primera.items[0]).toMatchObject({
      inicio: '2026-10-05T12:00:00-03:00',
      fin: '2026-10-05T12:45:00-03:00',
      todoElDia: false,
    });
    expect(consultasSedes).toBe(1);
  });

  it('pide a Comedor el rango con un día de más y con el token del alumno', async () => {
    let pedido: Request | undefined;
    e2e.server.use(
      http.get(RUTAS_CALENDARIO.COMEDOR, ({ request }) => {
        pedido = request;
        return HttpResponse.json({ items: [], nextCursor: null });
      }),
      ...fuentesConFixtures(),
    );
    await e2e.get(OCTUBRE);
    const url = new URL(pedido!.url);
    expect(url.searchParams.get('from')).toBe('2026-10-01');
    expect(url.searchParams.get('to')).toBe('2026-11-01');
    expect(pedido!.headers.get('authorization')).toBe(`Bearer ${e2e.token}`);
  });
});
