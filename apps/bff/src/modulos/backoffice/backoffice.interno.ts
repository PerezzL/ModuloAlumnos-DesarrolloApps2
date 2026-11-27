import { Inject, Injectable, Logger } from '@nestjs/common';
import { CONFIG, type Config } from '../../config/config';
import { correlationIdActual } from '../../comun/contexto';
import { armarUrl, type OpcionesLlamada } from '../../gateway/gateway.client';
import { invalido, pedir } from '../../gateway/pedido';
import { TokenServicio } from '../../servicio/token-servicio';

class TokenRechazado extends Error {}

/**
 * Lecturas internas de Backoffice (`/internal/v1/*`, spec BO1 del Módulo 8). Se llaman directo
 * al backend de Backoffice, sin pasar por el Gateway, con el token de servicio del BFF: el
 * token del alumno no se reenvía nunca. Si Backoffice rechaza el token (401), se pide uno
 * nuevo y se reintenta una vez; las demás fallas no se reintentan.
 */
@Injectable()
export class BackofficeInternoClient {
  private readonly logger = new Logger(BackofficeInternoClient.name);

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    private readonly tokens: TokenServicio,
  ) {}

  async get(ruta: string, opciones: OpcionesLlamada = {}): Promise<unknown> {
    const token = await this.tokens.obtener();
    try {
      return await this.llamar(token, ruta, opciones);
    } catch (error) {
      if (!(error instanceof TokenRechazado)) throw error;
      this.tokens.invalidar(token);
    }
    try {
      return await this.llamar(await this.tokens.obtener(), ruta, opciones);
    } catch (error) {
      if (error instanceof TokenRechazado) {
        throw invalido('BACKOFFICE', 'Backoffice rechazó el token de servicio');
      }
      throw error;
    }
  }

  private llamar(token: string, ruta: string, { query }: OpcionesLlamada): Promise<unknown> {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    const correlationId = correlationIdActual();
    if (correlationId) headers['X-Correlation-Id'] = correlationId;
    return pedir({
      modulo: 'BACKOFFICE',
      metodo: 'GET',
      url: armarUrl(this.config.BACKOFFICE_INTERNAL_URL, ruta, query),
      headers,
      timeoutMs: this.config.GATEWAY_TIMEOUT_MS,
      logger: this.logger,
      mensajeError: 'Respuesta de error de Backoffice',
      en401: () => new TokenRechazado(),
    });
  }
}
