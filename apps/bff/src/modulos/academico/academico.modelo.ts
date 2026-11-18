import type {
  Asignatura,
  CorrelativaFaltante,
  EstadoCursada,
  Horario,
  Periodo,
} from '@uadenet/api-types';

/**
 * Modelos propios con lo que el portal necesita del Módulo 9. Los arma el adaptador; el resto
 * del BFF trabaja con estos tipos y nunca con la respuesta del módulo.
 */

export interface PeriodoAcademico extends Periodo {
  /** Inicio de la ventana de inscripción: las 00:00 del primer día, hora de Argentina */
  inscripcionDesde?: string;
  /** Fin de la ventana de inscripción: el último instante del último día, hora de Argentina */
  inscripcionHasta?: string;
}

/** Una comisión que se ofrece en el período (sin las canceladas ni las finalizadas). */
export interface CursoDelPeriodo {
  cursoId: string;
  asignaturaId: string;
  nombre?: string;
  /** Nombre de la sede: null si no viene */
  sede: string | null;
  /** El horario del curso: vacío si no viene */
  horarios: Horario[];
  cupoMaximo: number;
  inscriptosActivos: number;
}

/** Una comisión de la oferta, con su asignatura resuelta desde el plan. */
export interface CursoOfertado extends Omit<CursoDelPeriodo, 'asignaturaId'> {
  asignatura: Asignatura;
}

/** Una correlativa de una asignatura: misma forma que la faltante del contrato. */
export type Correlativa = CorrelativaFaltante;

export interface InscripcionAlumno {
  cursoId: string;
  comision?: string;
  asignatura: Asignatura;
  periodo: Periodo;
  /** Inicio de cursada del período, `YYYY-MM-DD`: ordena el historial */
  inicioPeriodo?: string;
  estado: EstadoCursada;
  /** Fecha de inscripción, `YYYY-MM-DD` */
  fecha?: string;
}
