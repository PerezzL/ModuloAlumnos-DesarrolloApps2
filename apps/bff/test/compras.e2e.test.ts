import { Contrato } from '@uadenet/contrato';
import type { PaginaCompras } from '@uadenet/api-types';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { cuerpo, GW, prepararE2E } from './app-e2e';
import { fixture } from './fixtures';

const contrato = new Contrato();
const ORDENES = `${GW}/api/v1/store/orders/me`;
const ordenes = fixture<{ items: object[] }>('store/orders-me.provisional.json').items;

/** La Tienda simulada: pagina las fixtures y registra la query que recibió */
function tienda(queries: URLSearchParams[] = []) {
  return http.get(ORDENES, ({ request }) => {
    const query = new URL(request.url).searchParams;
    queries.push(query);
    const page = Number(query.get('page'));
    const limit = Number(query.get('limit'));
    return HttpResponse.json({
      items: ordenes.slice((page - 1) * limit, page * limit),
      page,
      limit,
      total: ordenes.length,
    });
  });
}

describe('GET /compras', () => {
  const e2e = prepararE2E();

  it('devuelve la primera página según el contrato, con page 1 y limit 10 por defecto', async () => {
    const queries: URLSearchParams[] = [];
    e2e.server.use(tienda(queries));
    const res = await e2e.get('/compras');
    expect(res.status).toBe(200);
    expect(contrato.validar('get', '/compras', 200, res.body).errores).toEqual([]);
    expect(res.body).toMatchObject({ page: 1, limit: 10, total: 3 });
    expect((res.body as PaginaCompras).items).toHaveLength(3);
    expect(Object.fromEntries(queries[0]!)).toEqual({ page: '1', limit: '10' });
  });

  it('pasa la paginación a la Tienda', async () => {
    e2e.server.use(tienda());
    const res = await e2e.get('/compras?page=2&limit=2');
    expect(res.body).toMatchObject({ page: 2, limit: 2, total: 3 });
    expect((res.body as PaginaCompras).items).toHaveLength(1);
  });

  it('pasa los filtros a la Tienda', async () => {
    const queries: URLSearchParams[] = [];
    e2e.server.use(tienda(queries));
    const res = await e2e.get(
      '/compras?desde=2026-09-01&hasta=2026-09-30&estado=COMPLETADA&sede=Monserrat&page=2',
    );
    expect(res.status).toBe(200);
    expect(Object.fromEntries(queries[0]!)).toEqual({
      page: '2',
      limit: '10',
      desde: '2026-09-01',
      hasta: '2026-09-30',
      estado: 'COMPLETADA',
      sede: 'Monserrat',
    });
  });

  it('sin filtros, no manda parámetros de filtro', async () => {
    const queries: URLSearchParams[] = [];
    e2e.server.use(tienda(queries));
    await e2e.get('/compras');
    expect([...queries[0]!.keys()]).toEqual(['page', 'limit']);
  });

  it.each([
    'page=0',
    'page=abc',
    'limit=51',
    'limit=0',
    'page=1.5',
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
    e2e.server.use(http.get(ORDENES, () => new HttpResponse(null, { status })));
    const res = await e2e.get('/compras');
    expect(res.status).toBe(status);
    expect(cuerpo(res)).toMatchObject({ code, modulo: 'TIENDA' });
    expect(contrato.validar('get', '/compras', status, cuerpo(res)).errores).toEqual([]);
  });
});

describe('GET /compras/{orderId}', () => {
  const e2e = prepararE2E();
  const ORDEN = `${GW}/api/v1/store/orders/:orderId`;

  it('devuelve el detalle según el contrato', async () => {
    let pedido: unknown;
    e2e.server.use(
      http.get(ORDEN, ({ params }) => {
        pedido = params.orderId;
        return HttpResponse.json(ordenes[0]);
      }),
    );
    const res = await e2e.get('/compras/93b28f67-e111-4a0d-b857-fdd015c4d3f1');
    expect(res.status).toBe(200);
    expect(contrato.validar('get', '/compras/{orderId}', 200, res.body).errores).toEqual([]);
    expect(res.body).toMatchObject({ subtotal: '3500.00', total: '3500.00' });
    expect(pedido).toBe('93b28f67-e111-4a0d-b857-fdd015c4d3f1');
  });

  it.each([404, 403])('si la Tienda responde %i, es 404 COMPRA_NO_ENCONTRADA', async (status) => {
    e2e.server.use(http.get(ORDEN, () => HttpResponse.json({}, { status })));
    const res = await e2e.get('/compras/de-otro');
    expect(res.status).toBe(404);
    expect(cuerpo(res)).toMatchObject({ code: 'COMPRA_NO_ENCONTRADA' });
    expect(contrato.validar('get', '/compras/{orderId}', 404, cuerpo(res)).errores).toEqual([]);
  });

  it.each([
    [503, 'UPSTREAM_UNAVAILABLE'],
    [504, 'UPSTREAM_TIMEOUT'],
  ])('Gateway %i → %s de TIENDA', async (status, code) => {
    e2e.server.use(http.get(ORDEN, () => new HttpResponse(null, { status })));
    const res = await e2e.get('/compras/x');
    expect(res.status).toBe(status);
    expect(cuerpo(res)).toMatchObject({ code, modulo: 'TIENDA' });
  });
});
