import { ProblemaError } from './problema';

const idInvalido = (nombre: string) =>
  new ProblemaError(400, 'SOLICITUD_INVALIDA', 'Solicitud inválida', {
    detail: `${nombre} debe ser un id no vacío`,
  });

/** Un id opcional de la query: string no vacío, sin interpretarlo. */
export function idOpcional(nombre: string, valor: unknown): string | undefined {
  if (valor === undefined) return undefined;
  if (typeof valor !== 'string' || valor === '') throw idInvalido(nombre);
  return valor;
}

/** `{ cursoId }` del cuerpo del POST de inscripción. Cualquier otro campo se ignora. */
export function cursoIdDelCuerpo(cuerpo: unknown): string {
  const cursoId = (cuerpo as { cursoId?: unknown } | null)?.cursoId;
  if (typeof cursoId !== 'string' || cursoId === '') throw idInvalido('cursoId');
  return cursoId;
}
