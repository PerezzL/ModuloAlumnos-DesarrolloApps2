import { Router } from 'express';
import { fixture } from '../fixtures.js';
import { enviarProblema } from '../problema.js';

/** Módulo 8. Qué campos trae (y si trae `planId`) está pendiente de confirmar. */
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
  return router;
}
