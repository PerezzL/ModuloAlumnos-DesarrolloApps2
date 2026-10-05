import type { InstanciaExamen, ResultadoExamen } from '@uadenet/api-types';

/** Instancias y resultados de examen del Módulo 2 (`x-provisional`: los supusimos nosotros) */
export const INSTANCIA: Record<InstanciaExamen, string> = {
  PARCIAL: 'Parcial',
  RECUPERATORIO: 'Recuperatorio',
  FINAL: 'Final',
};

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
