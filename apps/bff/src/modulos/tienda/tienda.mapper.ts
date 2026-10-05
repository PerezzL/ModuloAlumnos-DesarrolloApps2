import type { CompraDetalle, CompraResumen, PaginaCompras } from '@uadenet/api-types';
import type { z } from 'zod';
import { idOpaco, parsearOrigen } from '../comun';
import { type Orden, OrdenDetalle, PaginaOrdenes } from './tienda.origen';

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

/**
 * Suma importes decimales como texto, con enteros grandes: nunca pasa por float.
 * `["1250.5", "1000.00"]` → `"2250.50"` (tantos decimales como el que más tenga, mínimo 2).
 */
export function sumarMontos(montos: string[]): string {
  const decimales = Math.max(2, ...montos.map((m) => m.split('.')[1]?.length ?? 0));
  const escala = 10n ** BigInt(decimales);
  const total = montos.reduce((suma, m) => {
    const negativo = m.startsWith('-');
    const [enteros = '0', fraccion = ''] = m.replace(/^-/, '').split('.');
    const valor = BigInt(enteros) * escala + BigInt(fraccion.padEnd(decimales, '0') || '0');
    return suma + (negativo ? -valor : valor);
  }, 0n);
  const absoluto = total < 0n ? -total : total;
  const signo = total < 0n ? '-' : '';
  return `${signo}${absoluto / escala}.${String(absoluto % escala).padStart(decimales, '0')}`;
}

/**
 * Orden con productos → detalle. Nombres y precios son los congelados por la Tienda al momento
 * de la compra. Si la Tienda no informa el subtotal de la orden, es la suma de los productos.
 */
export function aCompraDetalle(datos: unknown): CompraDetalle {
  const orden = parsearOrigen('TIENDA', OrdenDetalle, datos);
  return {
    ...aResumen(orden),
    productos: orden.productos.map((p) => ({
      ...(p.productoId !== undefined && { productoId: idOpaco(p.productoId) }),
      nombre: p.nombre,
      cantidad: p.cantidad,
      precioUnitario: p.precioUnitario,
      subtotal: p.subtotal,
    })),
    subtotal: orden.subtotal ?? sumarMontos(orden.productos.map((p) => p.subtotal)),
  };
}
