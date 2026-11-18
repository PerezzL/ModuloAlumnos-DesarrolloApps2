import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createRemoteJWKSet, errors, jwtVerify } from 'jose';
import { CONFIG, type Config } from '../config/config';
import { ProblemaError } from '../comun/problema';
import type { RequestConAlumno } from './alumno.decorator';
import { ES_PUBLICO } from './publico.decorator';

const noAutenticado = () => new ProblemaError(401, 'AUTH_TOKEN_INVALID', 'No autenticado');

/**
 * Claims `careerIds` y `planIds` del token de CORE → ids opacos (vistos en un token real,
 * noviembre 2026). Un claim ausente o con otra forma se ignora (undefined): la carrera y el
 * plan salen entonces de Backoffice.
 */
export function idsDelClaim(claim: unknown): string[] | undefined {
  if (!Array.isArray(claim)) return undefined;
  return claim
    .filter((id): id is string | number => typeof id === 'string' || typeof id === 'number')
    .map(String);
}

/**
 * Valida localmente el JWT de CORE en cada request (defensa en profundidad: el Gateway ya lo
 * validó). Firma RS256 contra el JWKS, issuer, audience y expiración. Las claves se cachean
 * sin vencimiento y se vuelven a pedir ante un `kid` desconocido o una firma que no verifica:
 * CORE regenera la clave al reiniciar y puede mantener el mismo `kid`. Las dos recargas
 * respetan la espera de 30 s entre pedidos.
 */
@Injectable()
export class JwtGuard implements CanActivate {
  private readonly logger = new Logger(JwtGuard.name);
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    private readonly reflector: Reflector,
  ) {
    this.jwks = createRemoteJWKSet(new URL(config.JWKS_URL), {
      cacheMaxAge: Number.POSITIVE_INFINITY,
      cooldownDuration: 30_000,
      timeoutDuration: 5_000,
    });
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const publico = this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (publico) return true;

    const req = ctx.switchToHttp().getRequest<RequestConAlumno>();
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) throw noAutenticado();

    let sub: string | undefined;
    let email: unknown;
    let carreraIds: string[] | undefined;
    let planIds: string[] | undefined;
    try {
      const { payload } = await this.verificar(header.slice(7));
      sub = payload.sub;
      email = payload.email;
      carreraIds = idsDelClaim(payload.careerIds);
      planIds = idsDelClaim(payload.planIds);
    } catch (error) {
      this.logger.debug({ err: error }, 'Token rechazado');
      throw noAutenticado();
    }
    if (!sub) throw noAutenticado();

    // Si vino por el Gateway, X-User-Id tiene que coincidir con el token
    const xUserId = req.header('x-user-id');
    if (xUserId !== undefined && xUserId !== sub) throw noAutenticado();

    req.alumno = {
      id: sub,
      ...(typeof email === 'string' && { email }),
      ...(carreraIds && { carreraIds }),
      ...(planIds && { planIds }),
    };
    return true;
  }

  /**
   * Verifica el token. Si la firma no verifica con la clave cacheada, vuelve a pedir el JWKS
   * una vez (fuera de la espera entre pedidos) y reintenta.
   */
  private async verificar(token: string) {
    const opciones = {
      algorithms: ['RS256'],
      issuer: this.config.JWT_ISSUER,
      audience: this.config.JWT_AUDIENCE,
      requiredClaims: ['sub', 'exp'],
    };
    try {
      return await jwtVerify(token, this.jwks, opciones);
    } catch (error) {
      if (!(error instanceof errors.JWSSignatureVerificationFailed) || this.jwks.coolingDown) {
        throw error;
      }
      await this.jwks.reload();
      return jwtVerify(token, this.jwks, opciones);
    }
  }
}
