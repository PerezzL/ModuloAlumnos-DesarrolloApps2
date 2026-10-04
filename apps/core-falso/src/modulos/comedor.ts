import { Router } from 'express';
import { fixture } from '../fixtures.js';
import { esDemo } from './comun.js';

/** Módulo 4. Rutas ya reescritas por el Gateway (`/api/v1/dining/*` → `/api/v1/*`). */
export function moduloComedor() {
  const router = Router();
  router.get('/api/v1/reservations/me', (req, res) => {
    res.json(
      fixture(
        esDemo(req)
          ? 'dining/reservations-me.provisional.json'
          : 'dining/reservations-me-vacio.provisional.json',
      ),
    );
  });
  return router;
}
