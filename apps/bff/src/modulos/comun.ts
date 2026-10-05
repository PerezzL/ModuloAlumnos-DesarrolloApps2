import type { ModuloExterno } from '@uadenet/api-types';
import type { z } from 'zod';
import { ProblemaError } from '../comun/problema';

/** La respuesta de un módulo no tiene la forma esperada: para el front es un 502 de ese módulo. */
export const respuestaInvalida = (modulo: ModuloExterno, detail: string, cause?: unknown) =>
  new ProblemaError(502, 'UPSTREAM_INVALID', 'Respuesta inválida de un módulo', {
    modulo,
    detail,
    cause,
  });

/** Valida la respuesta cruda de un módulo con su schema de origen, o lanza 502. */
export function parsearOrigen<T extends z.ZodTypeAny>(
  modulo: ModuloExterno,
  schema: T,
  datos: unknown,
): z.infer<T> {
  const resultado = schema.safeParse(datos);
  if (resultado.success) return resultado.data as z.infer<T>;
  const primero = resultado.error.issues[0];
  throw respuestaInvalida(
    modulo,
    `Forma inesperada en ${primero?.path.join('.') || '(raíz)'}: ${primero?.message ?? ''}`,
    resultado.error,
  );
}

/** Ids opacos: los que llegan como número se pasan a string, sin otra interpretación. */
export const idOpaco = (valor: string | number) => String(valor);
