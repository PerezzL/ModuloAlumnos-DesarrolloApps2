import { fechaSinHora, solicitudInvalida } from '../comun/parametros';
import type { ConsultaCompras } from '../modulos/tienda/tienda.adapter';

function entero(nombre: string, valor: unknown, porDefecto: number, maximo = Infinity): number {
  if (valor === undefined) return porDefecto;
  const n = typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : NaN;
  if (!Number.isSafeInteger(n) || n < 1 || n > maximo) {
    throw solicitudInvalida(
      `${nombre} debe ser un entero mayor a 0${maximo === Infinity ? '' : ` y hasta ${maximo}`}`,
    );
  }
  return n;
}

function texto(nombre: string, valor: unknown): string | undefined {
  if (valor === undefined) return undefined;
  if (typeof valor !== 'string' || valor === '') {
    throw solicitudInvalida(`${nombre} debe ser un texto no vacío`);
  }
  return valor;
}

/**
 * Query de `GET /compras`: `page` (desde 1, por defecto 1), `limit` (1 a 50, por defecto 10)
 * y los filtros opcionales `desde`/`hasta` (inclusive, `YYYY-MM-DD`), `estado` y `sede`.
 */
export function parsearConsultaCompras(query: Record<string, unknown>): ConsultaCompras {
  const desde = query.desde === undefined ? undefined : fechaSinHora('desde', query.desde);
  const hasta = query.hasta === undefined ? undefined : fechaSinHora('hasta', query.hasta);
  // Las fechas YYYY-MM-DD se comparan bien como texto
  if (desde && hasta && hasta < desde)
    throw solicitudInvalida('hasta no puede ser anterior a desde');
  return {
    page: entero('page', query.page, 1),
    limit: entero('limit', query.limit, 10, 50),
    filtros: {
      ...(desde && { desde }),
      ...(hasta && { hasta }),
      ...(query.estado !== undefined && { estado: texto('estado', query.estado) }),
      ...(query.sede !== undefined && { sede: texto('sede', query.sede) }),
    },
  };
}
