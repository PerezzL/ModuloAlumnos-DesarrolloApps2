import { Router } from 'express';
import { fixture } from '../fixtures.js';
import { esDemo } from './comun.js';

/** Módulo 4. Rutas ya reescritas por el Gateway (`/api/v1/dining/*` → `/api/v1/*`). */
export function moduloComedor() {
  const router = Router();
  router.get('/api/v1/reservations/me', (req, res) => {
    res.json(
      esDemo(req) ? fixture('dining/reservations-me.provisional.json') : { reservations: [] },
    );
  });
  return router;
}
