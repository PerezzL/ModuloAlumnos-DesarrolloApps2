import { ProblemaError } from './problema';

export const solicitudInvalida = (detail: string) =>
  new ProblemaError(400, 'SOLICITUD_INVALIDA', 'Solicitud inválida', { detail });

const idInvalido = (nombre: string) => solicitudInvalida(`${nombre} debe ser un id no vacío`);

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

/** `YYYY-MM-DD` que además es una fecha real (rechaza 2026-02-30) */
export function fechaSinHora(nombre: string, valor: unknown): string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw solicitudInvalida(`${nombre} es obligatorio, con formato YYYY-MM-DD`);
  }
  const ms = Date.parse(`${valor}T00:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== valor) {
    throw solicitudInvalida(`${nombre} no es una fecha válida`);
  }
  return valor;
}
