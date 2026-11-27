import { Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { CONFIG, type Config } from '../config/config';
import { correlationIdActual } from '../comun/contexto';
import { ProblemaError } from '../comun/problema';

/** `POST /internal/v1/service-auth/token` de CORE (CORE_INTEGRACION.md, sección 4). */
const RespuestaToken = z.object({
  accessToken: z.string().min(1),
  expiresIn: z.number().positive(),
});

/** Se renueva un minuto antes de que venza (o a la mitad de su vida, si dura menos de 2) */
const MARGEN_MS = 60_000;

const fallaCore = (status: 502 | 503 | 504, detail: string, cause?: unknown) =>
  new ProblemaError(
    status,
    status === 504
      ? 'UPSTREAM_TIMEOUT'
      : status === 503
        ? 'UPSTREAM_UNAVAILABLE'
        : 'UPSTREAM_INVALID',
    'No se pudo obtener el token de servicio',
    { modulo: 'CORE', detail, cause },
  );

/**
 * Token de servicio del BFF (`student-service`), para las llamadas backend a backend que no
 * van con el token del alumno. Lo cachea en memoria hasta poco antes de que venza; si varios
 * pedidos lo necesitan a la vez, se pide uno solo. No es estado del request: si se pierde, se
 * vuelve a pedir.
 */
@Injectable()
export class TokenServicio {
  private readonly logger = new Logger(TokenServicio.name);
  private vigente?: { token: string; vence: number };
  private enCurso?: Promise<string>;
  /** Reloj, reemplazable en los tests */
  ahora: () => number = Date.now;

  constructor(@Inject(CONFIG) private readonly config: Config) {}

  obtener(): Promise<string> {
    if (this.vigente && this.vigente.vence > this.ahora()) {
      return Promise.resolve(this.vigente.token);
    }
    this.enCurso ??= this.pedir().finally(() => {
      this.enCurso = undefined;
    });
    return this.enCurso;
  }

  /** El destino rechazó este token: el próximo `obtener()` pide uno nuevo. */
  invalidar(token: string) {
    if (this.vigente?.token === token) this.vigente = undefined;
  }

  private async pedir(): Promise<string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    const correlationId = correlationIdActual();
    if (correlationId) headers['X-Correlation-Id'] = correlationId;

    let respuesta: Response;
    try {
      respuesta = await fetch(this.config.SERVICE_TOKEN_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          clientId: this.config.SERVICE_CLIENT_ID,
          clientSecret: this.config.SERVICE_CLIENT_SECRET,
        }),
        signal: AbortSignal.timeout(this.config.GATEWAY_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw fallaCore(504, 'CORE no respondió a tiempo');
      }
      throw fallaCore(503, 'CORE no está disponible', error);
    }

    const texto = await respuesta.text();
    if (!respuesta.ok) {
      this.logger.debug(
        { status: respuesta.status, cuerpo: texto.slice(0, 1000) },
        'Respuesta de error del token de servicio',
      );
      // 4xx: credenciales mal cargadas. Es configuración nuestra, no una caída de CORE
      if (respuesta.status < 500) {
        throw fallaCore(502, `CORE rechazó las credenciales de servicio (${respuesta.status})`);
      }
      throw fallaCore(503, `CORE respondió ${respuesta.status}`);
    }

    let datos: z.infer<typeof RespuestaToken>;
    try {
      datos = RespuestaToken.parse(JSON.parse(texto));
    } catch (error) {
      throw fallaCore(502, 'Respuesta inválida del token de servicio', error);
    }
    const vidaMs = datos.expiresIn * 1000;
    this.vigente = {
      token: datos.accessToken,
      vence: this.ahora() + Math.max(vidaMs - MARGEN_MS, vidaMs / 2),
    };
    return datos.accessToken;
  }
}
