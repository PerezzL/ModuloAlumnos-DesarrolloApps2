import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ProblemaError } from '../comun/problema';
import { CONFIG, type Config } from '../config/config';
import { verificarFirma } from './firma';
import { ES_PUBLICO } from './publico.decorator';

/**
 * Rechaza los pedidos que no firmó el Gateway de CORE (`X-Core-Signature`). Corre antes del
 * guard del JWT: así el BFF no es accesible desde afuera aunque su URL sea pública. Las rutas
 * públicas (health) no se firman; `/docs` y el health en la raíz se sirven antes de Nest.
 *
 * Responde 403 y no 401: el front toma un 401 como sesión vencida y no es el caso.
 */
@Injectable()
export class FirmaGuard implements CanActivate {
  constructor(
    @Inject(CONFIG) private readonly config: Config,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const publico = this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (publico) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const valida = verificarFirma(
      this.config.CORE_SIGNATURE_SECRET,
      {
        metodo: req.method,
        ruta: req.originalUrl,
        userId: req.header('x-user-id'),
        correlationId: req.header('x-correlation-id'),
        timestamp: req.header('x-core-timestamp'),
        firma: req.header('x-core-signature'),
      },
      Date.now(),
    );
    if (!valida) {
      throw new ProblemaError(403, 'GATEWAY_SIGNATURE_INVALID', 'Pedido no firmado por el Gateway');
    }
    return true;
  }
}
