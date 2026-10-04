import type { Response } from 'express';

/** Errores con la forma de la sección 13 de CORE_INTEGRACION.md. */
export function enviarProblema(
  res: Response,
  status: number,
  code: string,
  title: string,
  extra: Record<string, unknown> = {},
) {
  res
    .status(status)
    .type('application/problem+json')
    .send(
      JSON.stringify({
        type: 'about:blank',
        title,
        status,
        code,
        correlationId: res.getHeader('X-Correlation-Id'),
        ...extra,
      }),
    );
}
