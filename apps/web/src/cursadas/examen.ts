import type { InstanciaExamen, ResultadoExamen } from '@uadenet/api-types';

/** Instancias (categorías) y resultados de examen del Módulo 2 */
export const INSTANCIA: Record<InstanciaExamen, string> = {
  PARCIAL: 'Parcial',
  RECUPERATORIO: 'Recuperatorio',
  INTEGRADOR: 'Integrador',
  FINAL: 'Final',
};

/** Una categoría que no conocemos llega como null: el catálogo del Módulo 2 puede crecer */
export const instanciaLegible = (instancia?: InstanciaExamen | null) =>
  instancia ? INSTANCIA[instancia] : '—';

export const RESULTADO: Record<ResultadoExamen, string> = {
  APROBADO: 'Aprobado',
  DESAPROBADO: 'Desaprobado',
  AUSENTE: 'Ausente',
};

/** Sin resultado todavía, el examen está pendiente de nota */
export const resultadoLegible = (resultado?: ResultadoExamen) =>
  resultado ? RESULTADO[resultado] : 'Pendiente';

/** Nota con coma decimal; sin nota, "—" */
export const notaLegible = (nota?: number | null) =>
  nota == null ? '—' : new Intl.NumberFormat('es-AR').format(nota);

/** Ruta propia del detalle de una nota (4.7) */
export const rutaNota = (cursoId: string, notaId: string) =>
  `/cursadas/${encodeURIComponent(cursoId)}/notas/${encodeURIComponent(notaId)}`;
