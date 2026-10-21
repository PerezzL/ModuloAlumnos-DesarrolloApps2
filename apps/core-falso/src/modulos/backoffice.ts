import { Router } from 'express';
import { fixture } from '../fixtures.js';
import { paginar, QueryInvalida } from '../paginacion.js';
import { enviarProblema } from '../problema.js';

interface Sede {
  siteId: string;
  status: string;
}

/**
 * Módulo 8. Las sedes siguen su documento de flujo de datos; qué campos trae el usuario (y
 * si trae `planId`) está pendiente de confirmar.
 */
export function moduloBackoffice() {
  const router = Router();
  router.get('/api/v1/users/:userId', (req, res) => {
    const usuarios = fixture<Record<string, unknown>>('backoffice/users.provisional.json');
    const usuario = Object.hasOwn(usuarios, req.params.userId)
      ? usuarios[req.params.userId]
      : undefined;
    if (!usuario) return enviarProblema(res, 404, 'NOT_FOUND', 'Usuario inexistente');
    res.json(usuario);
  });

  const sedes = () => fixture<{ items: Sede[] }>('backoffice/sites.json').items;
  router.get('/api/v1/sites', (req, res) => {
    const { status, cursor, limit } = req.query;
    const filtradas = status === undefined ? sedes() : sedes().filter((s) => s.status === status);
    try {
      res.json(paginar(filtradas, cursor, limit));
    } catch (error) {
      if (!(error instanceof QueryInvalida)) throw error;
      enviarProblema(res, 400, 'VALIDATION_ERROR', error.message);
    }
  });
  router.get('/api/v1/sites/:siteId', (req, res) => {
    const sede = sedes().find((s) => s.siteId === req.params.siteId);
    if (!sede) return enviarProblema(res, 404, 'NOT_FOUND', 'Sede inexistente');
    res.json(sede);
  });
  return router;
}
