import type { ModuloExterno, Problema } from '@uadenet/api-types';

/**
 * Error con forma de problem+json. Es la única forma en que el BFF responde errores:
 * el filtro global lo serializa tal cual, con un `code` estable para el frontend.
 */
export class ProblemaError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly title: string,
    readonly opciones: {
      detail?: string;
      modulo?: ModuloExterno;
      extra?: Record<string, unknown>;
      cause?: unknown;
    } = {},
  ) {
    super(opciones.detail ?? title, { cause: opciones.cause });
    this.name = 'ProblemaError';
  }

  aProblema(correlationId?: string): Problema & Record<string, unknown> {
    const { detail, modulo, extra } = this.opciones;
    return {
      type: 'about:blank',
      title: this.title,
      status: this.status,
      code: this.code,
      ...(detail !== undefined && { detail }),
      ...(modulo !== undefined && { modulo }),
      ...extra,
      ...(correlationId !== undefined && { correlationId }),
    };
  }
}
