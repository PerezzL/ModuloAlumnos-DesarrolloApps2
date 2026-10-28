import { http, HttpResponse } from 'msw';
import type { CompraResumen } from '@uadenet/api-types';
import { BFF } from './servidor';

/** El id de `sedesBase` de cada sede: el listado trae el nombre, el filtro manda el id */
const ID_DE_SEDE: Record<string, string> = {
  'Sede Monserrat': 'sede-monserrat',
  'Sede Recoleta': 'sede-recoleta',
};

/** 12 compras, de la más reciente a la más antigua */
export const comprasBase = (): CompraResumen[] =>
  Array.from({ length: 12 }, (_, i) => ({
    orderId: `orden-${i + 1}`,
    fecha: `2026-09-${String(28 - i).padStart(2, '0')}T16:20:00.000Z`,
    sede: i % 2 === 0 ? 'Sede Monserrat' : 'Sede Recoleta',
    estado: i === 2 ? 'FAILED' : 'COMPLETED',
    cantidadProductos: i === 1 ? 1 : 3,
    total: i === 0 ? '3500.00' : `${(i + 1) * 1000}.50`,
  }));

/**
 * BFF simulado de compras: filtra `compras`, pagina por cursor (el `orderId` de la última
 * compra de la página anterior) y registra cada query recibida.
 */
export function bffCompras(compras = comprasBase(), queries: URLSearchParams[] = []) {
  return http.get(`${BFF}/compras`, ({ request }) => {
    const query = new URL(request.url).searchParams;
    queries.push(query);
    const limit = Number(query.get('limit') ?? 10);
    const cursor = query.get('cursor');
    const estado = query.get('estado');
    const desde = query.get('desde');
    const hasta = query.get('hasta');
    const sede = query.get('sede');
    const filtradas = compras.filter(
      (c) =>
        (!estado || c.estado === estado) &&
        (!desde || c.fecha.slice(0, 10) >= desde) &&
        (!hasta || c.fecha.slice(0, 10) <= hasta) &&
        (!sede || ID_DE_SEDE[c.sede ?? ''] === sede),
    );
    const inicio = cursor ? filtradas.findIndex((c) => c.orderId === cursor) + 1 : 0;
    const items = filtradas.slice(inicio, inicio + limit);
    return HttpResponse.json({
      items,
      nextCursor: inicio + limit < filtradas.length ? items.at(-1)!.orderId : null,
    });
  });
}
