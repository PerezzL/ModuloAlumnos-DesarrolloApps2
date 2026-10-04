import type { ModuloExterno, Problema } from '@uadenet/api-types';

/** problem+json tal como llega: `type` puede faltar (vale `about:blank`). */
export type ProblemaRecibido = Omit<Problema, 'type'> & { type?: string };

/**
 * Error de una llamada al BFF o a CORE, con el problem+json que vino en la respuesta.
 * Si el cuerpo no era problem+json, se arma uno mínimo con el status.
 */
export class ErrorApi extends Error {
  constructor(readonly problema: ProblemaRecibido) {
    super(problema.detail ?? problema.title);
    this.name = 'ErrorApi';
  }

  get status() {
    return this.problema.status;
  }

  get code() {
    return this.problema.code;
  }
}

/** No hubo respuesta (sin conexión, CORS, DNS). No es un rechazo ni un error del servidor. */
export class ErrorRed extends Error {
  constructor(cause?: unknown) {
    super('Sin conexión', { cause });
    this.name = 'ErrorRed';
  }
}

const esProblema = (cuerpo: unknown): cuerpo is ProblemaRecibido =>
  typeof cuerpo === 'object' &&
  cuerpo !== null &&
  typeof (cuerpo as ProblemaRecibido).status === 'number' &&
  typeof (cuerpo as ProblemaRecibido).code === 'string';

/** Arma el ErrorApi de una respuesta no exitosa, con o sin cuerpo problem+json. */
export function errorDeRespuesta(status: number, cuerpo: unknown, correlationId?: string | null) {
  if (esProblema(cuerpo)) return new ErrorApi(cuerpo);
  return new ErrorApi({
    title: 'Error inesperado',
    status,
    code: `HTTP_${status}`,
    ...(correlationId && { correlationId }),
  });
}

/**
 * Desenvuelve la respuesta de openapi-fetch: devuelve `data` o lanza ErrorApi / ErrorRed.
 * openapi-fetch relanza el error de `fetch` cuando no hubo respuesta.
 */
export async function datosDe<T>(
  llamada: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let resultado: Awaited<typeof llamada>;
  try {
    resultado = await llamada;
  } catch (error) {
    throw new ErrorRed(error);
  }
  const { data, error, response } = resultado;
  if (!response.ok || error !== undefined) {
    throw errorDeRespuesta(response.status, error, response.headers.get('X-Correlation-Id'));
  }
  return data as T;
}

export const NOMBRE_MODULO: Record<ModuloExterno, string> = {
  CORE: 'CORE',
  DOCENTE: 'Docente',
  BIBLIOTECA: 'Biblioteca',
  COMEDOR: 'Comedor',
  TIENDA: 'Tienda',
  EVENTOS: 'Eventos',
  BACKOFFICE: 'Backoffice',
  GESTION_ACADEMICA: 'Gestión Académica',
};

export type TipoFalla = 'caido' | 'invalido' | 'demora' | 'sin-conexion' | 'otro';

export interface DescripcionError {
  tipo: TipoFalla;
  titulo: string;
  mensaje: string;
  correlationId?: string;
}

/**
 * Traduce un error a un mensaje para el alumno. Distingue módulo caído (503), respuesta
 * inválida (502) y demora (504) usando `code` y `modulo` del problem+json; `fuente` nombra
 * la parte de la pantalla cuando el error no dice qué módulo falló (por ejemplo, CORE).
 */
export function describirError(error: unknown, fuente?: string): DescripcionError {
  if (error instanceof ErrorRed) {
    return {
      tipo: 'sin-conexion',
      titulo: 'Sin conexión',
      mensaje: 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.',
    };
  }
  if (!(error instanceof ErrorApi)) {
    return { tipo: 'otro', titulo: 'Algo salió mal', mensaje: 'Ocurrió un error inesperado.' };
  }

  const { problema } = error;
  const quien = problema.modulo ? `El módulo ${NOMBRE_MODULO[problema.modulo]}` : fuente;
  const sujeto = quien ?? 'El servicio';
  const base = { correlationId: problema.correlationId };

  if (problema.status === 503 || problema.code === 'UPSTREAM_UNAVAILABLE') {
    return {
      ...base,
      tipo: 'caido',
      titulo: 'Servicio no disponible',
      mensaje: `${sujeto} no está disponible en este momento. Probá de nuevo en unos minutos.`,
    };
  }
  if (problema.status === 504 || problema.code === 'UPSTREAM_TIMEOUT') {
    return {
      ...base,
      tipo: 'demora',
      titulo: 'Está tardando demasiado',
      mensaje: `${sujeto} no respondió a tiempo. Podés reintentar.`,
    };
  }
  if (problema.status === 502 || problema.code === 'UPSTREAM_INVALID') {
    return {
      ...base,
      tipo: 'invalido',
      titulo: 'Respuesta inesperada',
      mensaje: `${sujeto} respondió algo que no pudimos interpretar.`,
    };
  }
  return {
    ...base,
    tipo: 'otro',
    titulo: problema.title,
    mensaje: problema.detail ?? 'Ocurrió un error inesperado.',
  };
}
