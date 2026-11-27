import { timingSafeEqual } from 'node:crypto';
import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { ConfigCore } from './config.js';
import { bearer } from './auth.js';
import type { Fallas } from './fallas.js';
import { enviarProblema } from './problema.js';
import { TTL_SERVICIO_S, type Tokens } from './tokens.js';
import { setTimeout as esperar } from 'node:timers/promises';

/** Permisos que CORE le asignó a `student-service` (docs/integraciones.md) */
const PERMISOS_PORTAL = ['backoffice:read', 'backoffice:people:read'];

const iguales = (a: string, b: string) => {
  const [x, y] = [Buffer.from(a), Buffer.from(b)];
  return x.length === y.length && timingSafeEqual(x, y);
};

/** `POST /internal/v1/service-auth/token`, como en la sección 4 de CORE_INTEGRACION.md. */
export function routerTokenServicio(config: ConfigCore, tokens: Tokens) {
  const router = Router();
  router.post('/token', async (req, res) => {
    const { clientId, clientSecret } = (req.body ?? {}) as Record<string, unknown>;
    const cliente = config.clienteServicio;
    if (
      typeof clientId !== 'string' ||
      typeof clientSecret !== 'string' ||
      !iguales(clientId, cliente.clientId) ||
      !iguales(clientSecret, cliente.clientSecret)
    ) {
      return enviarProblema(res, 401, 'AUTH_INVALID_CLIENT', 'Credenciales de servicio inválidas');
    }
    res.json({
      accessToken: await tokens.emitirServicio(clientId, PERMISOS_PORTAL),
      expiresIn: TTL_SERVICIO_S,
      tokenType: 'Bearer',
    });
  });
  return router;
}

/**
 * Lecturas internas de Backoffice (spec BO1 del Módulo 8): las mismas respuestas que por el
 * Gateway, pero solo con token de servicio. El de un alumno da 403. Respeta las fallas
 * simuladas de `backoffice`, así la falla parcial se sigue pudiendo mostrar.
 */
export function backofficeInterno(
  config: ConfigCore,
  tokens: Tokens,
  fallas: Fallas,
  rutas: RequestHandler,
) {
  const router = Router();
  router.use(async (req: Request, res: Response, next) => {
    const token = bearer(req);
    if (!token) return enviarProblema(res, 401, 'HTTP_401', 'No autenticado');
    const claims = await tokens.verificarServicio(token);
    if (!claims) {
      const esUsuario = await tokens.verificarAccess(token);
      return esUsuario
        ? enviarProblema(res, 403, 'FORBIDDEN', 'Solo con token de servicio')
        : enviarProblema(res, 401, 'HTTP_401', 'No autenticado');
    }
    const permiso = req.path.startsWith('/users/') ? 'backoffice:people:read' : 'backoffice:read';
    if (!claims.permissions.includes(permiso)) {
      return enviarProblema(res, 403, 'FORBIDDEN', `Falta el permiso ${permiso}`);
    }

    const falla = fallas.de('backoffice');
    if (falla?.tipo === 'caido') {
      return enviarProblema(res, 503, 'SERVICE_UNAVAILABLE', 'Backoffice no disponible');
    }
    if (falla?.tipo === 'invalido') return res.status(200).type('text/html').send('<html>');
    if (falla?.tipo === 'lento') {
      const demora = falla.demoraMs ?? Infinity;
      await esperar(Math.min(demora, config.timeoutGatewayMs));
      if (demora >= config.timeoutGatewayMs) {
        return enviarProblema(res, 504, 'TIMEOUT', 'Backoffice no respondió a tiempo');
      }
    }
    next();
  });
  router.use(rutas);
  return router;
}
