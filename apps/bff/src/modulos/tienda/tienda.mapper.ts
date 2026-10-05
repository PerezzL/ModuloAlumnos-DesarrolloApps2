import type { CompraResumen, PaginaCompras } from '@uadenet/api-types';
import type { z } from 'zod';
import { idOpaco, parsearOrigen } from '../comun';
import { type Orden, PaginaOrdenes } from './tienda.origen';

/** Orden de la Tienda → resumen. Los importes se copian como string, sin pasar por float. */
function aResumen(orden: z.infer<typeof Orden>): CompraResumen {
  return {
    orderId: idOpaco(orden.orderId),
    fecha: orden.fecha,
    sede: orden.sede ?? null,
    estado: orden.estado,
    // Si el listado no trae los productos (contrato sin definir), la cantidad se omite
    ...(orden.productos && {
      cantidadProductos: orden.productos.reduce((total, p) => total + p.cantidad, 0),
    }),
    total: orden.total,
  };
}

export function aPaginaCompras(datos: unknown): PaginaCompras {
  const pagina = parsearOrigen('TIENDA', PaginaOrdenes, datos);
  return {
    items: pagina.items.map(aResumen),
    page: pagina.page,
    limit: pagina.limit,
    total: pagina.total,
  };
}
