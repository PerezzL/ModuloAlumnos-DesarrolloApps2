import { ProblemaError } from '../comun/problema';

/** Un id opcional de la query: string no vacío, sin interpretarlo. */
export function idOpcional(nombre: string, valor: unknown): string | undefined {
  if (valor === undefined) return undefined;
  if (typeof valor !== 'string' || valor === '') {
    throw new ProblemaError(400, 'SOLICITUD_INVALIDA', 'Solicitud inválida', {
      detail: `${nombre} debe ser un id no vacío`,
    });
  }
  return valor;
}
