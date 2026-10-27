import { http, HttpResponse } from 'msw';
import type { CompraResumen } from '@uadenet/api-types';
import { BFF } from './servidor';

/** El id de `sedesBase` de cada sede: el listado trae el nombre, el filtro manda el id */
const ID_DE_SEDE: Record<string, string> = {
  Monserrat: 'sede-monserrat',
  Recoleta: 'sede-recoleta',
};

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
    return HttpResponse.json({
      items: filtradas.slice((page - 1) * limit, page * limit),
      page,
      limit,
      total: filtradas.length,
    });
  });
}
