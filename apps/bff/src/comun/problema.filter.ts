import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { correlationIdActual } from './contexto';
import { ProblemaError } from './problema';

const CODIGOS_HTTP: Record<number, [code: string, title: string]> = {
  400: ['SOLICITUD_INVALIDA', 'Solicitud inválida'],
  401: ['AUTH_TOKEN_INVALID', 'No autenticado'],
  403: ['PROHIBIDO', 'Sin permiso'],
  404: ['NO_ENCONTRADO', 'No encontrado'],
  405: ['METODO_NO_PERMITIDO', 'Método no permitido'],
  413: ['SOLICITUD_DEMASIADO_GRANDE', 'Solicitud demasiado grande'],
  415: ['TIPO_NO_SOPORTADO', 'Tipo de contenido no soportado'],
};

/** Convierte cualquier excepción en problem+json. Nunca responde HTML ni un stack trace. */
@Catch()
export class ProblemaFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemaFilter.name);

  catch(excepcion: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const problema = this.aProblemaError(excepcion);

    if (problema.status >= 500) {
      this.logger.error({ err: excepcion, code: problema.code }, problema.title);
    }

    res
      .status(problema.status)
      .type('application/problem+json')
      .send(JSON.stringify(problema.aProblema(correlationIdActual())));
  }

  private aProblemaError(excepcion: unknown): ProblemaError {
    if (excepcion instanceof ProblemaError) return excepcion;
    if (excepcion instanceof HttpException) {
      const status = excepcion.getStatus();
      const [code, title] = CODIGOS_HTTP[status] ?? ['ERROR', excepcion.message];
      return new ProblemaError(status, code, title);
    }
    return new ProblemaError(HttpStatus.INTERNAL_SERVER_ERROR, 'ERROR_INTERNO', 'Error interno');
  }
}
