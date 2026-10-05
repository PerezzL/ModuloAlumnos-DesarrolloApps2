import { z } from 'zod';

const monto = z.string().regex(/^-?\d+(\.\d+)?$/, 'se esperaba un importe decimal como string');

const Producto = z
  .object({
    productoId: z.union([z.string(), z.number()]).optional(),
    nombre: z.string(),
    cantidad: z.number().int(),
    precioUnitario: monto,
    subtotal: monto,
  })
  .passthrough();

/**
 * Una orden de la Tienda. Contrato PROPUESTO (fixture `store/orders-me.provisional.json`):
 * falta definir qué campos van en el listado y cuáles solo en el detalle, así que `productos`
 * es opcional en el listado. Este tipo no sale de la carpeta del adaptador.
 */
export const Orden = z
  .object({
    orderId: z.union([z.string(), z.number()]),
    fecha: z.string().datetime({ offset: true }),
    sede: z.string().nullable().optional(),
    estado: z.string(),
    productos: z.array(Producto).optional(),
    subtotal: monto.optional(),
    total: monto,
  })
  .passthrough();

/** Respuesta de `GET /api/store/orders/me?page=&limit=` (Módulo 5, propuesto). */
export const PaginaOrdenes = z
  .object({
    items: z.array(Orden),
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
  })
  .passthrough();

/** Respuesta de `GET /api/store/orders/:orderId` (Módulo 5, propuesto): la orden con productos. */
export const OrdenDetalle = Orden.extend({ productos: z.array(Producto) });
