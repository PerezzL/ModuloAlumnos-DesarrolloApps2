import type { Asignatura, CorrelativaFaltante, EstadoCursada, Periodo } from '@uadenet/api-types';

/**
 * Modelos propios con lo que el portal necesita del Módulo 9. Los arma el adaptador; el resto
 * del BFF trabaja con estos tipos y nunca con la respuesta del módulo.
 */

export interface PeriodoAcademico extends Periodo {
  inscripcionDesde?: string;
  inscripcionHasta?: string;
}

export interface CursoOfertado {
  cursoId: string;
  nombre?: string;
  cupoMaximo: number;
  inscriptosActivos: number;
  asignatura: Asignatura;
}

/** Una correlativa de una asignatura: misma forma que la faltante del contrato. */
export type Correlativa = CorrelativaFaltante;

export interface InscripcionAlumno {
  cursoId: string;
  asignatura: Asignatura;
  periodo: Periodo;
  notaFinal: number | null;
  estado: EstadoCursada;
  fecha?: string;
}
