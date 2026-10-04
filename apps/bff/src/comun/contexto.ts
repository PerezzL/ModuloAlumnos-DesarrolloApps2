import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const HEADER_CORRELATION = 'x-correlation-id';

interface ContextoRequest {
  correlationId: string;
}

const almacen = new AsyncLocalStorage<ContextoRequest>();

/** Correlation id del request en curso (undefined fuera de un request). */
export function correlationIdActual(): string | undefined {
  return almacen.getStore()?.correlationId;
}

/**
 * Toma el X-Correlation-Id que manda el Gateway o genera uno. Lo deja en el request (para
 * los logs), en la respuesta y en el contexto asíncrono (para las llamadas salientes).
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction) {
  const recibido = req.header(HEADER_CORRELATION);
  const correlationId = recibido && recibido.length <= 128 ? recibido : randomUUID();
  req.headers[HEADER_CORRELATION] = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);
  almacen.run({ correlationId }, next);
}
