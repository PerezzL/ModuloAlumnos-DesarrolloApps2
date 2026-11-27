import { Inject, Injectable, Logger } from '@nestjs/common';
import { CONFIG, type Config } from '../config/config';
import { authorizationActual, correlationIdActual } from '../comun/contexto';
import { ProblemaError } from '../comun/problema';
import { pedir, type ModuloLlamado } from './pedido';

export { RespuestaModuloError } from './pedido';

/**
 * Módulos a los que el BFF llama por el Gateway. CORE no se llama desde el BFF, y Backoffice
 * se lee directo con el token de servicio (`BackofficeInternoClient`).
 */
export type ModuloGateway = Exclude<ModuloLlamado, 'BACKOFFICE'>;

type Query = Record<string, string | number | boolean | undefined>;

export interface OpcionesLlamada {
  query?: Query;
}

/**
 * Llama a los módulos por el Gateway de CORE, reenviando el token del alumno y el
 * X-Correlation-Id, y traduce las fallas a ProblemaError con el módulo que falló. No
 * reintenta: el Gateway ya reintenta una vez los GET por conexión, y un POST (inscripción)
 * no se debe repetir solo.
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

  private llamar(
    metodo: 'GET' | 'POST',
    modulo: ModuloGateway,
    ruta: string,
    body: unknown,
    { query }: OpcionesLlamada,
  ): Promise<unknown> {
    const headers: Record<string, string> = {};
    const authorization = authorizationActual();
    if (authorization) headers.Authorization = authorization;
    const correlationId = correlationIdActual();
    if (correlationId) headers['X-Correlation-Id'] = correlationId;

    return pedir({
      modulo,
      metodo,
      url: armarUrl(this.config.GATEWAY_URL, `${this.prefijos[modulo]}${ruta}`, query),
      headers,
      body,
      timeoutMs: this.config.GATEWAY_TIMEOUT_MS,
      logger: this.logger,
      mensajeError: 'Respuesta de error del Gateway',
      // El Gateway rechazó el token del alumno: la sesión no es válida
      en401: () => new ProblemaError(401, 'AUTH_TOKEN_INVALID', 'No autenticado'),
    });
  }
}

/** Une la base y la ruta (la base puede traer path propio) y agrega la query. */
export function armarUrl(base: string, ruta: string, query?: Query): URL {
  const url = new URL(`${base.replace(/\/$/, '')}${ruta}`);
  for (const [clave, valor] of Object.entries(query ?? {})) {
    if (valor !== undefined) url.searchParams.set(clave, String(valor));
  }
  return url;
}
