import type { Request, Response } from 'express';
import type { ConfigCore } from './config.js';
import { bearer } from './auth.js';
import { enviarProblema } from './problema.js';
import type { Tokens } from './tokens.js';

/** Rutas que el Gateway deja pasar sin token (sección 2 de CORE_INTEGRACION.md). */
const PUBLICAS = [/^\/health\/(live|ready)$/, /^\/docs(\/.*)?$/, /^\/docs-json$/];

// Headers hop-by-hop que no se reenvían
const NO_REENVIAR = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'keep-alive',
  'upgrade',
]);

/**
 * Gateway: valida el token, borra los X-User-* que vengan de afuera, inyecta los propios y
 * reenvía al servicio. `/api/v1/{prefijo}/x` llega como `{destino}/x`, donde `destino` ya
 * incluye la base a la que se reescribe (CORE usa `/api/v1`; Prism sirve en la raíz).
 * No transforma la respuesta. Caído → 503, timeout → 504.
 */
export function gateway(config: ConfigCore, tokens: Tokens, destino: () => string) {
  return async (req: Request, res: Response) => {
    // req.url ya viene sin el prefijo con el que se montó el handler
    const ruta = req.url;
    const sinQuery = ruta.split('?')[0] ?? '';

    const headers: Record<string, string> = {};
    for (const [clave, valor] of Object.entries(req.headers)) {
      if (valor === undefined || NO_REENVIAR.has(clave) || clave.startsWith('x-user-')) continue;
      headers[clave] = Array.isArray(valor) ? valor.join(', ') : valor;
    }
    headers['x-correlation-id'] = String(res.getHeader('X-Correlation-Id'));

    const token = bearer(req);
    const claims = token ? await tokens.verificarAccess(token) : undefined;
    if (claims) {
      headers['x-user-id'] = claims.sub;
      headers['x-user-roles'] = claims.roles.join(',');
      headers['x-user-permissions'] = claims.permissions.join(',');
    } else if (!PUBLICAS.some((p) => p.test(sinQuery))) {
      return enviarProblema(res, 401, 'AUTH_TOKEN_INVALID', 'No autenticado');
    }

    const tieneCuerpo = !['GET', 'HEAD'].includes(req.method);
    let respuesta: globalThis.Response;
    try {
      respuesta = await fetch(`${destino().replace(/\/$/, '')}${ruta}`, {
        method: req.method,
        headers,
        body: tieneCuerpo && req.body !== undefined ? JSON.stringify(req.body) : undefined,
        signal: AbortSignal.timeout(config.timeoutGatewayMs),
        redirect: 'manual',
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        return enviarProblema(res, 504, 'UPSTREAM_TIMEOUT', 'El servicio no respondió a tiempo');
      }
      return enviarProblema(res, 503, 'UPSTREAM_UNAVAILABLE', 'Servicio no disponible');
    }

    res.status(respuesta.status);
    respuesta.headers.forEach((valor, clave) => {
      if (!NO_REENVIAR.has(clave) && clave !== 'content-encoding') res.setHeader(clave, valor);
    });
    res.send(Buffer.from(await respuesta.arrayBuffer()));
  };
}
