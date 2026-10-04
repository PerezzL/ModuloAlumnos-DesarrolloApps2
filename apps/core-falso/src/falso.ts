import { Router } from 'express';
import { esModulo } from './config.js';
import { validarFalla, type Fallas } from './fallas.js';
import { enviarProblema } from './problema.js';

export interface OpcionesFalso {
  fallas: Fallas;
  /** Vuelven el estado en memoria a las fixtures */
  reinicios: (() => void)[];
}

/**
 * Endpoints de prueba, solo del CORE falso (no existen en CORE): fallas simuladas y reset.
 * No piden token, para poder usarlos con curl durante una demo.
 */
export function routerFalso({ fallas, reinicios }: OpcionesFalso) {
  const router = Router();

  router.get('/fallas', (_req, res) => {
    res.json(fallas.todas());
  });

  router.put('/fallas/:modulo', (req, res) => {
    const { modulo } = req.params;
    if (!esModulo(modulo)) return enviarProblema(res, 404, 'NOT_FOUND', 'Módulo desconocido');
    const { tipo, demoraMs } = (req.body ?? {}) as { tipo?: unknown; demoraMs?: unknown };
    try {
      fallas.poner(modulo, validarFalla(tipo, demoraMs));
    } catch (error) {
      return enviarProblema(res, 400, 'VALIDATION_ERROR', (error as Error).message);
    }
    res.json(fallas.todas());
  });

  router.delete('/fallas/:modulo', (req, res) => {
    const { modulo } = req.params;
    if (!esModulo(modulo)) return enviarProblema(res, 404, 'NOT_FOUND', 'Módulo desconocido');
    fallas.quitar(modulo);
    res.json(fallas.todas());
  });

  /** Estado en memoria y fallas vuelven a como arrancó el CORE falso */
  router.post('/reset', (_req, res) => {
    fallas.reiniciar();
    for (const reiniciar of reinicios) reiniciar();
    res.status(204).end();
  });

  return router;
}
