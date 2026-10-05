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

  it.each(['page=0', 'page=abc', 'limit=51', 'limit=0', 'page=1.5'])(
    '%s es 400 SOLICITUD_INVALIDA',
    async (query) => {
      const res = await e2e.get(`/compras?${query}`);
      expect(res.status).toBe(400);
      expect(cuerpo(res)).toMatchObject({ code: 'SOLICITUD_INVALIDA' });
      expect(contrato.validar('get', '/compras', 400, cuerpo(res)).errores).toEqual([]);
    },
  );

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
