import type { CategoriaCalendario } from '@uadenet/api-types';
import { fechaSinHora as fecha, solicitudInvalida } from '../comun/parametros';
import { ProblemaError } from '../comun/problema';
import type { Rango } from './rango';

export const CATEGORIAS: readonly CategoriaCalendario[] = ['COMEDOR', 'EVENTO', 'EXAMEN'];
export const MAX_DIAS = 62;

const DIA_MS = 24 * 60 * 60 * 1000;

const rangoInvalido = (detail: string) =>
  new ProblemaError(400, 'RANGO_INVALIDO', 'Rango inválido', { detail });

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
