import { ProblemaError } from '../comun/problema';
import type { ConsultaCompras } from '../modulos/tienda/tienda.adapter';

const invalido = (detail: string) =>
  new ProblemaError(400, 'SOLICITUD_INVALIDA', 'Solicitud inválida', { detail });

function entero(nombre: string, valor: unknown, porDefecto: number, maximo = Infinity): number {
  if (valor === undefined) return porDefecto;
  const n = typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : NaN;
  if (!Number.isSafeInteger(n) || n < 1 || n > maximo) {
    throw invalido(
      `${nombre} debe ser un entero mayor a 0${maximo === Infinity ? '' : ` y hasta ${maximo}`}`,
    );
  }
  return n;
}

/** `page` (desde 1, por defecto 1) y `limit` (1 a 50, por defecto 10), como en el contrato. */
export function parsearConsultaCompras(query: Record<string, unknown>): ConsultaCompras {
  return {
    page: entero('page', query.page, 1),
    limit: entero('limit', query.limit, 10, 50),
  };
}
