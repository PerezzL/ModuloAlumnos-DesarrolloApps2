import { createHmac } from 'node:crypto';

/**
 * `X-Core-Signature` como la calcula el Gateway real: HMAC-SHA256 en hexadecimal sobre método,
 * ruta de destino sin query, `X-User-Id`, `X-Correlation-Id` y `X-Core-Timestamp`, unidos por
 * `\n` y sin salto final.
 */
export function firmar(
  secreto: string,
  metodo: string,
  rutaDestino: string,
  userId: string,
  correlationId: string,
  timestamp: string,
): string {
  return createHmac('sha256', secreto)
    .update([metodo.toUpperCase(), rutaDestino, userId, correlationId, timestamp].join('\n'))
    .digest('hex');
}
