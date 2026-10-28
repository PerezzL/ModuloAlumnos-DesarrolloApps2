import { Router } from 'express';
import { fixture } from '../fixtures.js';
import { enviarProblema } from '../problema.js';
import { esDemo } from './comun.js';

interface Orden {
  id: string;
  siteId: string;
  status: string;
  createdAt: string;
}

const ESTADOS = ['PENDING_PAYMENT', 'COMPLETED', 'COMPENSATING', 'FAILED'];

/** Valida la query de `/orders/me` como la Tienda; devuelve el error o los filtros */
function consulta(query: Record<string, unknown>) {
  const { status, siteId, from, to, limit = '20', cursor } = query;
  const n = Number(limit);
  if (typeof limit !== 'string' || !Number.isInteger(n) || n < 1 || n > 100) {
    return { error: 'limit debe ser un entero entre 1 y 100' };
  }
  if (status !== undefined && !ESTADOS.includes(String(status))) {
    return { error: `status debe ser uno de ${ESTADOS.join(', ')}` };
  }
  for (const [nombre, valor] of [
    ['from', from],
    ['to', to],
  ] as const) {
    if (valor !== undefined && Number.isNaN(Date.parse(String(valor)))) {
      return { error: `${nombre} debe ser una fecha ISO 8601` };
    }
  }
  return {
    limit: n,
    cursor: cursor === undefined ? undefined : String(cursor),
    cumple: (o: Orden) => {
      const t = Date.parse(o.createdAt);
      if (status !== undefined && o.status !== status) return false;
      if (siteId !== undefined && o.siteId !== siteId) return false;
      if (from !== undefined && t < Date.parse(String(from))) return false;
      if (to !== undefined && t > Date.parse(String(to))) return false;
      return true;
    },
  };
}

/**
 * Módulo 5 (contrato confirmado). Solo devuelve las compras propias. Paginación por cursor
 * como la Tienda: el cursor es el `id` de la última orden de la página anterior.
 */
export function moduloTienda() {
  const router = Router();

  const ordenes = (demo: boolean) =>
    demo ? fixture<{ items: Orden[] }>('store/orders-me.json').items : [];

  router.get('/api/v1/orders/me', (req, res) => {
    const c = consulta(req.query);
    if ('error' in c) return enviarProblema(res, 400, 'VALIDATION_ERROR', c.error!);
    const filtradas = ordenes(esDemo(req)).filter(c.cumple);
    let desde = 0;
    if (c.cursor !== undefined) {
      const i = filtradas.findIndex((o) => o.id === c.cursor);
      if (i === -1) {
        return enviarProblema(res, 400, 'VALIDATION_ERROR', 'cursor inválido para estos filtros');
      }
      desde = i + 1;
    }
    const items = filtradas.slice(desde, desde + c.limit);
    const hayMas = desde + c.limit < filtradas.length;
    res.json({ items, nextCursor: hayMas ? items.at(-1)!.id : null });
  });

  router.get('/api/v1/orders/:id', (req, res) => {
    const orden = ordenes(esDemo(req)).find((o) => o.id === req.params.id);
    if (!orden) return enviarProblema(res, 404, 'NOT_FOUND', 'Compra inexistente');
    res.json(orden);
  });

  return router;
}
