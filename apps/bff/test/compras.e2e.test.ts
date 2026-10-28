import { Contrato } from '@uadenet/contrato';
import type { CompraDetalle, PaginaCompras } from '@uadenet/api-types';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { cuerpo, GW, prepararE2E } from './app-e2e';
import { RUTA_SEDES } from './calendario-gateway';
import { fixture } from './fixtures';

const contrato = new Contrato();
const ORDENES = `${GW}/api/v1/store/orders/me`;
const ORDEN = `${GW}/api/v1/store/orders/:id`;
const ordenes = fixture<{ items: { id: string }[] }>('store/orders-me.json').items;

const sedesOk = () =>
  http.get(RUTA_SEDES, () => HttpResponse.json(fixture('backoffice/sites.json')));

/** La Tienda simulada: devuelve una página con cursor y registra la query que recibió */
function tienda(queries: URLSearchParams[] = []) {
  return http.get(ORDENES, ({ request }) => {
    const query = new URL(request.url).searchParams;
    queries.push(query);
    const limit = Number(query.get('limit'));
    const items = ordenes.slice(0, limit);
    return HttpResponse.json({
      items,
      nextCursor: limit < ordenes.length ? items.at(-1)!.id : null,
    });
  });
}

describe('GET /compras', () => {
  const e2e = prepararE2E();

  it('devuelve la primera página según el contrato, con limit 10 y sin cursor', async () => {
    const queries: URLSearchParams[] = [];
    e2e.server.use(tienda(queries), sedesOk());
    const res = await e2e.get('/compras');
    expect(res.status).toBe(200);
    expect(contrato.validar('get', '/compras', 200, res.body).errores).toEqual([]);
    const pagina = res.body as PaginaCompras;
    expect(pagina.nextCursor).toBeNull();
    expect(pagina.items.map((c) => [c.sede, c.estado])).toEqual([
      ['Sede Monserrat', 'COMPLETED'],
      ['Sede Recoleta', 'COMPLETED'],
      ['Sede Monserrat', 'FAILED'],
    ]);
    expect(Object.fromEntries(queries[0]!)).toEqual({ limit: '10' });
  });

  it('pasa el cursor a la Tienda y devuelve su nextCursor', async () => {
    const queries: URLSearchParams[] = [];
    e2e.server.use(tienda(queries), sedesOk());
    const res = await e2e.get('/compras?limit=2&cursor=abc');
    expect((res.body as PaginaCompras).nextCursor).toBe(ordenes[1]!.id);
    expect(Object.fromEntries(queries[0]!)).toEqual({ limit: '2', cursor: 'abc' });
  });

  it('traduce los filtros a los de la Tienda, con las fechas como días completos en Argentina', async () => {
    const queries: URLSearchParams[] = [];
    e2e.server.use(tienda(queries), sedesOk());
    const res = await e2e.get(
      '/compras?desde=2026-09-01&hasta=2026-09-30&estado=COMPLETED&sede=3e9b0a12-55cc-4d77-9a01-6b2f8c4e1d90',
    );
    expect(res.status).toBe(200);
    expect(Object.fromEntries(queries[0]!)).toEqual({
      limit: '10',
      from: '2026-09-01T00:00:00.000-03:00',
      to: '2026-09-30T23:59:59.999-03:00',
      status: 'COMPLETED',
      siteId: '3e9b0a12-55cc-4d77-9a01-6b2f8c4e1d90',
    });
  });

  it('un 400 de la Tienda (cursor que no va con los filtros) es 400 SOLICITUD_INVALIDA', async () => {
    e2e.server.use(
      http.get(ORDENES, () => HttpResponse.json({ code: 'VALIDATION_ERROR' }, { status: 400 })),
      sedesOk(),
    );
    const res = await e2e.get('/compras?cursor=viejo&estado=FAILED');
    expect(res.status).toBe(400);
    expect(cuerpo(res)).toMatchObject({ code: 'SOLICITUD_INVALIDA' });
    expect(contrato.validar('get', '/compras', 400, cuerpo(res)).errores).toEqual([]);
  });

  it.each([
    'limit=51',
    'limit=0',
    'limit=1.5',
    'cursor=',
    'desde=2026-02-30',
    'hasta=30/09/2026',
    'desde=2026-09-30&hasta=2026-09-01',
    'estado=',
  ])('%s es 400 SOLICITUD_INVALIDA', async (query) => {
    const res = await e2e.get(`/compras?${query}`);
    expect(res.status).toBe(400);
    expect(cuerpo(res)).toMatchObject({ code: 'SOLICITUD_INVALIDA' });
    expect(contrato.validar('get', '/compras', 400, cuerpo(res)).errores).toEqual([]);
  });

  it.each([
    [503, 'UPSTREAM_UNAVAILABLE'],
    [502, 'UPSTREAM_INVALID'],
    [504, 'UPSTREAM_TIMEOUT'],
  ])('Gateway %i → %s de TIENDA', async (status, code) => {
    e2e.server.use(
      http.get(ORDENES, () => new HttpResponse(null, { status })),
      sedesOk(),
    );
    const res = await e2e.get('/compras');
    expect(res.status).toBe(status);
    expect(cuerpo(res)).toMatchObject({ code, modulo: 'TIENDA' });
    expect(contrato.validar('get', '/compras', status, cuerpo(res)).errores).toEqual([]);
  });
});

// App propia: la caché de sedes de los otros casos resolvería los nombres
describe('GET /compras con Backoffice caído', () => {
  const e2e = prepararE2E();

  it('las compras salen igual, con sede null', async () => {
    e2e.server.use(
      tienda(),
      http.get(RUTA_SEDES, () => new HttpResponse(null, { status: 503 })),
    );
    const res = await e2e.get('/compras');
    expect(res.status).toBe(200);
    expect(contrato.validar('get', '/compras', 200, res.body).errores).toEqual([]);
    expect((res.body as PaginaCompras).items.every((c) => c.sede === null)).toBe(true);
  });
});

describe('GET /compras/{orderId}', () => {
  const e2e = prepararE2E();

  it('devuelve el detalle según el contrato, con subtotales calculados', async () => {
    let pedido: unknown;
    e2e.server.use(
      http.get(ORDEN, ({ params }) => {
        pedido = params.id;
        return HttpResponse.json(ordenes[0]);
      }),
      sedesOk(),
    );
    const res = await e2e.get('/compras/93b28f67-e111-4a0d-b857-fdd015c4d3f1');
    expect(res.status).toBe(200);
    expect(contrato.validar('get', '/compras/{orderId}', 200, res.body).errores).toEqual([]);
    const detalle = res.body as CompraDetalle;
    expect(detalle).toMatchObject({
      sede: 'Sede Monserrat',
      subtotal: '3500.00',
      total: '3500.00',
    });
    expect(detalle.productos.map((p) => p.subtotal)).toEqual(['2500.00', '1000.00']);
    expect(pedido).toBe('93b28f67-e111-4a0d-b857-fdd015c4d3f1');
  });

  it('si la Tienda responde 404 (inexistente o de otro alumno), es 404 COMPRA_NO_ENCONTRADA', async () => {
    e2e.server.use(
      http.get(ORDEN, () => HttpResponse.json({}, { status: 404 })),
      sedesOk(),
    );
    const res = await e2e.get('/compras/de-otro');
    expect(res.status).toBe(404);
    expect(cuerpo(res)).toMatchObject({ code: 'COMPRA_NO_ENCONTRADA' });
    expect(contrato.validar('get', '/compras/{orderId}', 404, cuerpo(res)).errores).toEqual([]);
  });

  it.each([
    [503, 'UPSTREAM_UNAVAILABLE'],
    [504, 'UPSTREAM_TIMEOUT'],
  ])('Gateway %i → %s de TIENDA', async (status, code) => {
    e2e.server.use(
      http.get(ORDEN, () => new HttpResponse(null, { status })),
      sedesOk(),
    );
    const res = await e2e.get('/compras/x');
    expect(res.status).toBe(status);
    expect(cuerpo(res)).toMatchObject({ code, modulo: 'TIENDA' });
  });
});
