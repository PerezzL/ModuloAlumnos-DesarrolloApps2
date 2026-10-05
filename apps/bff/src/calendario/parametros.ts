import type { CategoriaCalendario } from '@uadenet/api-types';
import { ProblemaError } from '../comun/problema';
import type { Rango } from './rango';

export const CATEGORIAS: readonly CategoriaCalendario[] = ['COMEDOR', 'EVENTO', 'EXAMEN'];
export const MAX_DIAS = 62;

const DIA_MS = 24 * 60 * 60 * 1000;

const solicitudInvalida = (detail: string) =>
  new ProblemaError(400, 'SOLICITUD_INVALIDA', 'Solicitud inválida', { detail });
const rangoInvalido = (detail: string) =>
  new ProblemaError(400, 'RANGO_INVALIDO', 'Rango inválido', { detail });

/** `YYYY-MM-DD` que además es una fecha real (rechaza 2026-02-30) */
function fecha(nombre: string, valor: unknown): string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw solicitudInvalida(`${nombre} es obligatorio, con formato YYYY-MM-DD`);
  }
  const ms = Date.parse(`${valor}T00:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== valor) {
    throw solicitudInvalida(`${nombre} no es una fecha válida`);
  }
  return valor;
}

/** Valida `desde` y `hasta` (inclusive): `hasta` no anterior a `desde`, hasta 62 días. */
export function parsearRango(desde: unknown, hasta: unknown): Rango {
  const rango = { desde: fecha('desde', desde), hasta: fecha('hasta', hasta) };
  const dias =
    (Date.parse(`${rango.hasta}T00:00:00Z`) - Date.parse(`${rango.desde}T00:00:00Z`)) / DIA_MS + 1;
  if (dias < 1) throw rangoInvalido('hasta no puede ser anterior a desde.');
  if (dias > MAX_DIAS) throw rangoInvalido(`El rango no puede superar los ${MAX_DIAS} días.`);
  return rango;
}

/** `categorias=COMEDOR,EVENTO`. Sin el parámetro, las tres. Sin repetidos, en orden fijo. */
export function parsearCategorias(valor: unknown): CategoriaCalendario[] {
  if (valor === undefined) return [...CATEGORIAS];
  if (typeof valor !== 'string' || valor === '') {
    throw solicitudInvalida('categorias debe ser una lista separada por comas');
  }
  const pedidas = new Set(valor.split(',').map((c) => c.trim()));
  for (const c of pedidas) {
    if (!(CATEGORIAS as readonly string[]).includes(c)) {
      throw solicitudInvalida(`Categoría desconocida: ${c} (${CATEGORIAS.join(', ')})`);
    }
  }
  return CATEGORIAS.filter((c) => pedidas.has(c));
}
