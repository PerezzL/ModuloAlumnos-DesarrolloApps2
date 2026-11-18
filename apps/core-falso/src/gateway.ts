import { setTimeout as esperar } from 'node:timers/promises';
import type { Request, RequestHandler, Response } from 'express';
import type { ConfigCore, Modulo } from './config.js';
import { bearer } from './auth.js';
import { firmar } from './firma.js';
import type { Fallas } from './fallas.js';
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

export interface OpcionesGateway {
  modulo: Modulo;
  /** URL del servicio con la base incluida; sin valor, responde `local` */
  destino: () => string | undefined;
  /** Módulo falso en el mismo proceso, montado sobre la ruta ya reescrita (`/api/v1/...`) */
  local?: RequestHandler;
  fallas: Fallas;
}

/**
 * Gateway: valida el token, borra los X-User-* que vengan de afuera, inyecta los propios, firma
 * el pedido (`X-Core-Signature`) y reenvía al servicio. `/api/v1/{prefijo}/x` llega como `{destino}/x`, donde `destino` ya
 * incluye la base a la que se reescribe (CORE usa `/api/v1`; Prism sirve en la raíz).
 * No transforma la respuesta. Caído → 503, respuesta inválida → 502, timeout → 504, con los
 * `code` del OpenAPI de CORE. El CORE real responde 502 mientras el circuito sigue cerrado y
 * 503 recién cuando se abre (cinco fallas seguidas); acá un módulo caído es siempre 503.
 */
export function gateway(config: ConfigCore, tokens: Tokens, opciones: OpcionesGateway) {
  return async (req: Request, res: Response) => {
    // req.url ya viene sin el prefijo con el que se montó el handler
    const ruta = req.url;
    const sinQuery = ruta.split('?')[0] ?? '';

    const headers: Record<string, string> = {};
    for (const [clave, valor] of Object.entries(req.headers)) {
      if (valor === undefined || NO_REENVIAR.has(clave)) continue;
      if (clave.startsWith('x-user-') || clave.startsWith('x-core-')) continue;
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

    const falla = opciones.fallas.de(opciones.modulo);
    if (falla?.tipo === 'caido') {
      return enviarProblema(res, 503, 'GATEWAY_CIRCUIT_OPEN', 'Servicio no disponible');
    }
    if (falla?.tipo === 'invalido') {
      return enviarProblema(
        res,
        502,
        'GATEWAY_UPSTREAM_FAILURE',
        'Respuesta inválida del servicio',
      );
    }
    if (falla?.tipo === 'lento') {
      const demora = falla.demoraMs ?? Infinity;
      await esperar(Math.min(demora, config.timeoutGatewayMs));
      if (demora >= config.timeoutGatewayMs) return timeout(res);
    }

    const destino = opciones.destino();
    if (!destino) {
      if (!opciones.local) {
        return enviarProblema(res, 503, 'GATEWAY_UPSTREAM_UNCONFIGURED', 'Sin destino');
      }
      // Módulo falso: recibe lo mismo que recibiría por la red
      req.headers = headers;
      req.url = `/api/v1${ruta}`;
      return opciones.local(req, res, () =>
        enviarProblema(res, 404, 'NOT_FOUND', `No existe en el módulo ${opciones.modulo}`),
      );
    }

    const url = `${destino.replace(/\/$/, '')}${ruta}`;
    const timestamp = String(Date.now());
    headers['x-core-timestamp'] = timestamp;
    headers['x-core-signature'] = firmar(
      config.secretoFirma,
      req.method,
      new URL(url).pathname,
      headers['x-user-id'] ?? '',
      headers['x-correlation-id'],
      timestamp,
    );

    const tieneCuerpo = !['GET', 'HEAD'].includes(req.method);
    let respuesta: globalThis.Response;
    try {
      respuesta = await fetch(url, {
        method: req.method,
        headers,
        body: tieneCuerpo && req.body !== undefined ? JSON.stringify(req.body) : undefined,
        signal: AbortSignal.timeout(config.timeoutGatewayMs),
        redirect: 'manual',
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') return timeout(res);
      return enviarProblema(res, 503, 'GATEWAY_CIRCUIT_OPEN', 'Servicio no disponible');
    }

    res.status(respuesta.status);
    respuesta.headers.forEach((valor, clave) => {
      if (!NO_REENVIAR.has(clave) && clave !== 'content-encoding') res.setHeader(clave, valor);
    });
    res.send(Buffer.from(await respuesta.arrayBuffer()));
  };
}

const timeout = (res: Response) =>
  enviarProblema(res, 504, 'GATEWAY_UPSTREAM_FAILURE', 'El servicio no respondió a tiempo');
