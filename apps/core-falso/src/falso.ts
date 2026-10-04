import { Router } from 'express';
import { esModulo } from './config.js';
import { validarFalla, type Fallas } from './fallas.js';
import {
  ejemplo,
  esTipoNotificacion,
  TIPOS_NOTIFICACION,
  type Notificaciones,
} from './notificaciones.js';
import { enviarProblema } from './problema.js';
import { buscarPorEmail, buscarPorId, USUARIOS } from './usuarios.js';

export interface OpcionesFalso {
  fallas: Fallas;
  notificaciones: Notificaciones;
  /** Vuelven el estado en memoria a las fixtures */
  reinicios: (() => void)[];
}

/**
 * Endpoints de prueba, solo del CORE falso (no existen en CORE): fallas simuladas,
 * notificaciones a demanda y reset.
 * No piden token, para poder usarlos con curl durante una demo.
 */
export function routerFalso({ fallas, notificaciones, reinicios }: OpcionesFalso) {
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

  /**
   * Crea una notificación de ejemplo y la emite por el socket, como si CORE la derivara del
   * evento de otro módulo. `{ "tipo": "EVENT_REMINDER", "email": "..." }`; sin email ni
   * userId va al alumno demo.
   */
  router.post('/notificaciones', (req, res) => {
    const { tipo, email, userId } = (req.body ?? {}) as Record<string, unknown>;
    if (!esTipoNotificacion(tipo)) {
      return enviarProblema(
        res,
        400,
        'VALIDATION_ERROR',
        `tipo debe ser ${TIPOS_NOTIFICACION.join(', ')}`,
      );
    }
    const usuario =
      typeof email === 'string'
        ? buscarPorEmail(email)
        : typeof userId === 'string'
          ? buscarPorId(userId)
          : USUARIOS[0];
    if (!usuario) return enviarProblema(res, 404, 'NOT_FOUND', 'Usuario inexistente');
    res.status(201).json(notificaciones.crear(usuario.id, ejemplo(tipo)));
  });

  /** Estado en memoria y fallas vuelven a como arrancó el CORE falso */
  router.post('/reset', (_req, res) => {
    fallas.reiniciar();
    for (const reiniciar of reinicios) reiniciar();
    res.status(204).end();
  });

  return router;
}
