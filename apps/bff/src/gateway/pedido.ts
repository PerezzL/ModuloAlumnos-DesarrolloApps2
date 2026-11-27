import type { Logger } from '@nestjs/common';
import type { ModuloExterno } from '@uadenet/api-types';
import { ProblemaError } from '../comun/problema';

/** Módulos a los que llama el BFF: por el Gateway, o directo en el caso de Backoffice. */
export type ModuloLlamado = Exclude<ModuloExterno, 'CORE' | 'BIBLIOTECA'>;

/**
 * El módulo respondió un 4xx. El adaptador decide qué significa (por ejemplo, un 404 o un
 * 409 de negocio); si no lo atrapa, al front le llega como 502 porque es una respuesta que
 * el BFF no esperaba.
 */
export class RespuestaModuloError extends ProblemaError {
  constructor(
    modulo: ModuloLlamado,
    readonly estadoOrigen: number,
    readonly cuerpoOrigen: unknown,
  ) {
    super(502, 'UPSTREAM_INVALID', 'Respuesta inesperada de un módulo', {
      modulo,
      detail: `El módulo respondió ${estadoOrigen}`,
    });
  }
}

export const noDisponible = (modulo: ModuloLlamado, cause?: unknown) =>
  new ProblemaError(503, 'UPSTREAM_UNAVAILABLE', 'Módulo no disponible', { modulo, cause });
export const invalido = (modulo: ModuloLlamado, detail: string, cause?: unknown) =>
  new ProblemaError(502, 'UPSTREAM_INVALID', 'Respuesta inválida de un módulo', {
    modulo,
    detail,
    cause,
  });
const timeout = (modulo: ModuloLlamado) =>
  new ProblemaError(504, 'UPSTREAM_TIMEOUT', 'El módulo no respondió a tiempo', { modulo });

export interface Pedido {
  modulo: ModuloLlamado;
  metodo: 'GET' | 'POST';
  url: URL;
  headers: Record<string, string>;
  body?: unknown;
  timeoutMs: number;
  logger: Logger;
  /** Mensaje de la línea de debug con el cuerpo de error (se busca por él en Railway) */
  mensajeError: string;
  /** Qué significa un 401 para quien llama: el token del alumno o el de servicio */
  en401: () => Error;
}

/**
 * Hace un pedido a un módulo y traduce las fallas a ProblemaError con el módulo que falló.
 * No reintenta: lo decide quien llama.
 */
export async function pedir(p: Pedido): Promise<unknown> {
  const headers: Record<string, string> = { Accept: 'application/json', ...p.headers };
  if (p.body !== undefined) headers['Content-Type'] = 'application/json';

  const inicio = performance.now();
  let respuesta: Response;
  try {
    respuesta = await fetch(p.url, {
      method: p.metodo,
      headers,
      body: p.body === undefined ? undefined : JSON.stringify(p.body),
      signal: AbortSignal.timeout(p.timeoutMs),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') throw timeout(p.modulo);
    throw noDisponible(p.modulo, error);
  } finally {
    p.logger.debug({
      modulo: p.modulo,
      metodo: p.metodo,
      url: p.url,
      ms: Math.round(performance.now() - inicio),
    });
  }

  const texto = await respuesta.text();
  const cuerpo = parsear(texto);

  if (respuesta.ok) {
    if (cuerpo === SIN_JSON) {
      if (texto === '') return undefined;
      throw invalido(p.modulo, 'El cuerpo de la respuesta no es JSON');
    }
    return cuerpo;
  }
  // Lo que explica el Gateway (o el módulo) sobre la falla: el front solo recibe el code propio
  p.logger.debug(
    {
      modulo: p.modulo,
      status: respuesta.status,
      cuerpo: cuerpo === SIN_JSON ? texto.slice(0, MAX_CUERPO_LOG) : cuerpo,
    },
    p.mensajeError,
  );
  switch (respuesta.status) {
    case 503:
      throw noDisponible(p.modulo);
    case 504:
      throw timeout(p.modulo);
    case 502:
      throw invalido(p.modulo, 'El Gateway recibió una respuesta inválida del módulo');
    case 401:
      throw p.en401();
    case 429:
      // Límite de pedidos (CORE o Backoffice): para el alumno, el módulo no está disponible
      throw noDisponible(p.modulo);
  }
  if (respuesta.status >= 500) {
    throw invalido(p.modulo, `El módulo respondió ${respuesta.status}`);
  }
  throw new RespuestaModuloError(p.modulo, respuesta.status, cuerpo === SIN_JSON ? texto : cuerpo);
}

function parsear(texto: string): unknown {
  if (texto === '') return SIN_JSON;
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return SIN_JSON;
  }
}

const SIN_JSON = Symbol('SIN_JSON');
/** Un error que no es JSON puede ser una página HTML entera: se loguea solo el principio */
const MAX_CUERPO_LOG = 1000;
