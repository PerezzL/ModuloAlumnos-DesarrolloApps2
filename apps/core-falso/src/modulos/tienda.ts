import { Router } from 'express';
import { fixture } from '../fixtures.js';
import { enviarProblema } from '../problema.js';
import { entero, esDemo } from './comun.js';

interface Orden {
  orderId: string;
}

/** Módulo 5 (contrato propuesto). Solo devuelve las compras propias. */
export function moduloTienda() {
  const router = Router();

  const ordenes = (demo: boolean) =>
    demo ? fixture<{ items: Orden[] }>('store/orders-me.provisional.json').items : [];

  router.get('/api/v1/orders/me', (req, res) => {
    const page = entero(req.query.page, 1);
    const limit = entero(req.query.limit, 20, 100);
    const todas = ordenes(esDemo(req));
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
