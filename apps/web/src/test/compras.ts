import { http, HttpResponse } from 'msw';
import type { CompraResumen } from '@uadenet/api-types';
import { BFF } from './servidor';

/** 12 compras, de la más reciente a la más antigua */
export const comprasBase = (): CompraResumen[] =>
  Array.from({ length: 12 }, (_, i) => ({
    orderId: `orden-${i + 1}`,
    fecha: `2026-09-${String(28 - i).padStart(2, '0')}T16:20:00.000Z`,
    sede: i % 2 === 0 ? 'Monserrat' : 'Recoleta',
    estado: i === 2 ? 'CANCELADA' : 'COMPLETADA',
    cantidadProductos: i === 1 ? 1 : 3,
    total: i === 0 ? '3500.00' : `${(i + 1) * 1000}.50`,
  }));

/** BFF simulado de compras: pagina `compras` y registra cada query recibida */
export function bffCompras(compras = comprasBase(), queries: URLSearchParams[] = []) {
  return http.get(`${BFF}/compras`, ({ request }) => {
    const query = new URL(request.url).searchParams;
    queries.push(query);
    const page = Number(query.get('page') ?? 1);
    const limit = Number(query.get('limit') ?? 10);
    return HttpResponse.json({
      items: compras.slice((page - 1) * limit, page * limit),
      page,
      limit,
      total: compras.length,
    });
  });
}
