import { Router } from 'express';
import { fixture } from '../fixtures.js';
import { enviarProblema } from '../problema.js';
import { entero, esDemo } from './comun.js';

interface Orden {
  orderId: string;
  fecha: string;
  estado: string;
  siteId?: string | null;
  sede?: string | null;
}

const DIA_MS = 24 * 60 * 60 * 1000;
/** Inicio del día `YYYY-MM-DD` en Buenos Aires (UTC−3, sin horario de verano) */
const inicioDelDia = (fecha: string) => Date.parse(`${fecha}T00:00:00-03:00`);

/**
 * Filtros que la Tienda ofreció (fecha y estado) y el que le pedimos (sede, por `siteId` de
 * Backoffice). Los nombres de los parámetros y que la sede se filtre por `siteId` son una
 * suposición nuestra: `desde` y `hasta` inclusive, en `YYYY-MM-DD`.
 */
function filtrar(ordenes: Orden[], query: Record<string, unknown>) {
  const { desde, hasta, estado, sede } = query;
  return ordenes.filter((o) => {
    const t = Date.parse(o.fecha);
    if (typeof desde === 'string' && t < inicioDelDia(desde)) return false;
    if (typeof hasta === 'string' && t >= inicioDelDia(hasta) + DIA_MS) return false;
    if (typeof estado === 'string' && o.estado !== estado) return false;
    if (typeof sede === 'string' && o.siteId !== sede) return false;
    return true;
  });
}

/** Módulo 5 (contrato propuesto). Solo devuelve las compras propias. */
export function moduloTienda() {
  const router = Router();

  const ordenes = (demo: boolean) =>
    demo ? fixture<{ items: Orden[] }>('store/orders-me.provisional.json').items : [];

  router.get('/api/v1/orders/me', (req, res) => {
    const page = entero(req.query.page, 1);
    const limit = entero(req.query.limit, 20, 100);
    const todas = filtrar(ordenes(esDemo(req)), req.query);
    res.json({
      items: todas.slice((page - 1) * limit, page * limit),
      page,
      limit,
      total: todas.length,
    });
  });

  router.get('/api/v1/orders/:orderId', (req, res) => {
    const orden = ordenes(esDemo(req)).find((o) => o.orderId === req.params.orderId);
    if (!orden) return enviarProblema(res, 404, 'NOT_FOUND', 'Compra inexistente');
    res.json(orden);
  });

  return router;
}
