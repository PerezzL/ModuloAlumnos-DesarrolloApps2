import { createHmac, timingSafeEqual } from 'node:crypto';

/** Antigüedad máxima del `X-Core-Timestamp`, para adelante o para atrás. */
const VENTANA_MS = 5 * 60_000;

/** Lo que firma el Gateway de CORE en cada pedido que reenvía al BFF. */
export interface PedidoFirmado {
  metodo: string;
  /** Ruta tal como llega al BFF (`/api/v1/me`). La query, si viene, se descarta. */
  ruta: string;
  userId: string | undefined;
  correlationId: string | undefined;
  /** `X-Core-Timestamp`: milisegundos */
  timestamp: string | undefined;
  /** `X-Core-Signature`: HMAC-SHA256 en hexadecimal */
  firma?: string | undefined;
}

/**
 * HMAC-SHA256 en hexadecimal sobre método, ruta sin query, `X-User-Id`, `X-Correlation-Id` y
 * `X-Core-Timestamp`, unidos por `\n` y sin salto final (especificado por CORE, 17/11/2026).
 */
export function firmar(secreto: string, pedido: Omit<PedidoFirmado, 'firma'>): string {
  const texto = [
    pedido.metodo.toUpperCase(),
    pedido.ruta.split('?')[0],
    pedido.userId ?? '',
    pedido.correlationId ?? '',
    pedido.timestamp ?? '',
  ].join('\n');
  return createHmac('sha256', secreto).update(texto).digest('hex');
}

/**
 * True si el pedido trae todos los datos firmados, el timestamp está dentro de los 5 minutos y
 * la firma coincide. La comparación es en tiempo constante.
 */
export function verificarFirma(secreto: string, pedido: PedidoFirmado, ahora: number): boolean {
  const { firma, timestamp, userId, correlationId } = pedido;
  if (!firma || !timestamp || !userId || !correlationId) return false;
  if (!/^\d+$/.test(timestamp) || Math.abs(ahora - Number(timestamp)) > VENTANA_MS) return false;
  if (!/^[0-9a-f]{64}$/i.test(firma)) return false;
  const esperada = Buffer.from(firmar(secreto, pedido), 'hex');
  return timingSafeEqual(esperada, Buffer.from(firma, 'hex'));
}
