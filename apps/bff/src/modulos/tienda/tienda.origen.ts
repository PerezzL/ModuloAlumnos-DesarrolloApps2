import { z } from 'zod';

const monto = z.string().regex(/^-?\d+(\.\d+)?$/, 'se esperaba un importe decimal como string');

/** Un ítem de la orden: copia del producto al momento de la compra */
const Item = z
  .object({
    productId: z.string(),
    productName: z.string(),
    imageUrl: z.string().nullable().optional(),
    quantity: z.number().int().positive(),
    unitPrice: monto,
    color: z.string().nullable().optional(),
    size: z.string().nullable().optional(),
    sku: z.string().nullable().optional(),
  })
  .passthrough();

/**
 * Una orden de la Tienda (contrato confirmado, fixture `store/orders-me.json`). Listado y
 * detalle traen la misma orden completa. Este tipo no sale de la carpeta del adaptador.
 */
export const Orden = z
  .object({
    id: z.string(),
    siteId: z.string().nullable(),
    status: z.string(),
    createdAt: z.string().datetime({ offset: true }),
    total: monto,
    items: z.array(Item),
  })
  .passthrough();

/** Respuesta de `GET /api/v1/store/orders/me` (Módulo 5): paginación por cursor */
export const PaginaOrdenes = z
  .object({
    items: z.array(Orden),
    nextCursor: z.string().nullable(),
  })
  .passthrough();
