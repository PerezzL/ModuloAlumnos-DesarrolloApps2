import { Router } from 'express';
import { fixture } from '../fixtures.js';
import { enviarProblema } from '../problema.js';
import { esDemo } from './comun.js';

interface Turno {
  startAt: string;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Módulo 4. Rutas ya reescritas por el Gateway (`/api/v1/dining/*` → `/api/v1/*`).
 * `from` y `to` son fechas inclusive; el CORE falso las compara con la fecha UTC de `startAt`.
 */
export function moduloComedor() {
  const router = Router();
  router.get('/api/v1/calendar/me', (req, res) => {
    const [from, to] = [req.query.from, req.query.to];
    if ([from, to].some((v) => v !== undefined && (typeof v !== 'string' || !FECHA.test(v)))) {
      return enviarProblema(res, 400, 'VALIDATION_ERROR', 'from y to deben ser YYYY-MM-DD');
    }
    const desde = typeof from === 'string' ? from : '0000-01-01';
    const hasta = typeof to === 'string' ? to : '9999-12-31';
    const { items } = fixture<{ items: Turno[] }>(
      esDemo(req) ? 'dining/calendar-me.json' : 'dining/calendar-me-vacio.json',
    );
    const dia = (t: Turno) => t.startAt.slice(0, 10);
    res.json({
      items: items.filter((t) => dia(t) >= desde && dia(t) <= hasta),
      nextCursor: null,
    });
  });
  return router;
}
