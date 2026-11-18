import { z } from 'zod';

const url = z.string().url();
const prefijo = z.string().startsWith('/');

const esquema = z.object({
  BFF_PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  GATEWAY_URL: url,
  // Menor que los 10 s del Gateway: así el BFF responde el 504 con el módulo que tardó antes de
  // que el Gateway corte el pedido del front (docs/arquitectura.md)
  GATEWAY_TIMEOUT_MS: z.coerce.number().int().positive().default(8_000),
  // Secreto con el que el Gateway de CORE firma cada pedido (X-Core-Signature)
  CORE_SIGNATURE_SECRET: z.string().min(1),
  JWKS_URL: url,
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
  PREFIJO_DOCENTE: prefijo,
  PREFIJO_COMEDOR: prefijo,
  PREFIJO_TIENDA: prefijo,
  PREFIJO_EVENTOS: prefijo,
  PREFIJO_BACKOFFICE: prefijo,
  PREFIJO_ACADEMICO: prefijo,
});

export type Config = z.infer<typeof esquema>;

/** Token de inyección de la configuración validada. */
export const CONFIG = Symbol('CONFIG');

export class ConfigInvalidaError extends Error {}

/**
 * Valida las variables de entorno. Si falta o es inválida alguna, falla con la lista completa
 * para que el BFF no arranque a medias.
 */
export function cargarConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const resultado = esquema.safeParse(env);
  if (resultado.success) return resultado.data;
  const detalle = resultado.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new ConfigInvalidaError(`Configuración inválida del BFF:\n${detalle}`);
}
