import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ModuloExterno } from '@uadenet/api-types';
import { CONFIG, type Config } from '../config/config';
import { authorizationActual, correlationIdActual } from '../comun/contexto';
import { ProblemaError } from '../comun/problema';

/** Módulos a los que el BFF llama por el Gateway. CORE no se llama desde el BFF. */
export type ModuloGateway = Exclude<ModuloExterno, 'CORE' | 'BIBLIOTECA'>;

type Query = Record<string, string | number | boolean | undefined>;

export interface OpcionesLlamada {
  query?: Query;
}

/**
 * El módulo respondió un 4xx. El adaptador decide qué significa (por ejemplo, un 404 o un
 * 409 de negocio); si no lo atrapa, al front le llega como 502 porque es una respuesta que
 * el BFF no esperaba.
 */
export class RespuestaModuloError extends ProblemaError {
  constructor(
    modulo: ModuloGateway,
    readonly estadoOrigen: number,
    readonly cuerpoOrigen: unknown,
  ) {
    super(502, 'UPSTREAM_INVALID', 'Respuesta inesperada de un módulo', {
      modulo,
      detail: `El módulo respondió ${estadoOrigen}`,
    });
  }
}

const noDisponible = (modulo: ModuloGateway, cause?: unknown) =>
  new ProblemaError(503, 'UPSTREAM_UNAVAILABLE', 'Módulo no disponible', { modulo, cause });
const invalido = (modulo: ModuloGateway, detail: string, cause?: unknown) =>
  new ProblemaError(502, 'UPSTREAM_INVALID', 'Respuesta inválida de un módulo', {
    modulo,
    detail,
    cause,
  });
const timeout = (modulo: ModuloGateway) =>
  new ProblemaError(504, 'UPSTREAM_TIMEOUT', 'El módulo no respondió a tiempo', { modulo });

/**
 * Única pieza que llama a otros módulos. Lo hace siempre por el Gateway de CORE, reenviando
 * el token del alumno y el X-Correlation-Id, y traduce las fallas a ProblemaError con el
 * módulo que falló. No reintenta: el Gateway ya reintenta una vez los GET por conexión, y
 * un POST (inscripción) no se debe repetir solo.
 */
@Injectable()
export class GatewayClient {
  private readonly logger = new Logger(GatewayClient.name);
  private readonly prefijos: Record<ModuloGateway, string>;

  constructor(@Inject(CONFIG) private readonly config: Config) {
    this.prefijos = {
      DOCENTE: config.PREFIJO_DOCENTE,
      COMEDOR: config.PREFIJO_COMEDOR,
      TIENDA: config.PREFIJO_TIENDA,
      EVENTOS: config.PREFIJO_EVENTOS,
      BACKOFFICE: config.PREFIJO_BACKOFFICE,
      GESTION_ACADEMICA: config.PREFIJO_ACADEMICO,
    };
  }

  get(modulo: ModuloGateway, ruta: string, opciones: OpcionesLlamada = {}): Promise<unknown> {
    return this.llamar('GET', modulo, ruta, undefined, opciones);
  }

  post(
    modulo: ModuloGateway,
    ruta: string,
    body: unknown,
    opciones: OpcionesLlamada = {},
  ): Promise<unknown> {
    return this.llamar('POST', modulo, ruta, body, opciones);
  }

  private async llamar(
    metodo: 'GET' | 'POST',
    modulo: ModuloGateway,
    ruta: string,
    body: unknown,
    { query }: OpcionesLlamada,
  ): Promise<unknown> {
    const url = this.armarUrl(modulo, ruta, query);
    const headers: Record<string, string> = { Accept: 'application/json' };
    const authorization = authorizationActual();
    if (authorization) headers.Authorization = authorization;
    const correlationId = correlationIdActual();
    if (correlationId) headers['X-Correlation-Id'] = correlationId;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const inicio = performance.now();
    let respuesta: Response;
    try {
      respuesta = await fetch(url, {
        method: metodo,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.GATEWAY_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') throw timeout(modulo);
      throw noDisponible(modulo, error);
    } finally {
      this.logger.debug({ modulo, metodo, url, ms: Math.round(performance.now() - inicio) });
    }

    const texto = await respuesta.text();
    const cuerpo = this.parsear(texto);

    if (respuesta.ok) {
      if (cuerpo === SIN_JSON) {
        if (texto === '') return undefined;
        throw invalido(modulo, 'El cuerpo de la respuesta no es JSON');
      }
      return cuerpo;
    }
    // Lo que explica el Gateway (o el módulo) sobre la falla: el front solo recibe el code propio
    this.logger.debug(
      {
        modulo,
        status: respuesta.status,
        cuerpo: cuerpo === SIN_JSON ? texto.slice(0, MAX_CUERPO_LOG) : cuerpo,
      },
      'Respuesta de error del Gateway',
    );
    switch (respuesta.status) {
      case 503:
        throw noDisponible(modulo);
      case 504:
        throw timeout(modulo);
      case 502:
        throw invalido(modulo, 'El Gateway recibió una respuesta inválida del módulo');
      case 401:
        // El Gateway rechazó el token del alumno: la sesión no es válida
        throw new ProblemaError(401, 'AUTH_TOKEN_INVALID', 'No autenticado');
    }
    if (respuesta.status >= 500) {
      throw invalido(modulo, `El módulo respondió ${respuesta.status}`);
    }
    throw new RespuestaModuloError(modulo, respuesta.status, cuerpo === SIN_JSON ? texto : cuerpo);
  }

  private armarUrl(modulo: ModuloGateway, ruta: string, query?: Query): URL {
    const url = new URL(`${this.prefijos[modulo]}${ruta}`, this.config.GATEWAY_URL);
    for (const [clave, valor] of Object.entries(query ?? {})) {
      if (valor !== undefined) url.searchParams.set(clave, String(valor));
    }
    return url;
  }

  private parsear(texto: string): unknown {
    if (texto === '') return SIN_JSON;
    try {
      return JSON.parse(texto) as unknown;
    } catch {
      return SIN_JSON;
    }
  }
}

const SIN_JSON = Symbol('SIN_JSON');
/** Un error que no es JSON puede ser una página HTML entera: se loguea solo el principio */
const MAX_CUERPO_LOG = 1000;
