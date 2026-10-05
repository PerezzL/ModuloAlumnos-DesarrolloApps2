import type { CursadaResumen } from '@uadenet/api-types';
import type { InscripcionAlumno } from '../modulos/academico/academico.modelo';

const EN_CURSO: ReadonlySet<CursadaResumen['estado']> = new Set(['INSCRIPTO', 'CURSANDO']);

const fechaMs = (i: InscripcionAlumno) => (i.fecha === undefined ? -Infinity : Date.parse(i.fecha));

/**
 * De la más reciente a la más antigua según la fecha de inscripción (los ids de período son
 * opacos: no se ordenan). Sin fecha, van al final en el orden en que llegaron.
 */
export const masRecientesPrimero = (inscripciones: InscripcionAlumno[]) =>
  [...inscripciones].sort((a, b) => fechaMs(b) - fechaMs(a));

/** Una inscripción como cursada. La situación es la del Módulo 9: el portal no la calcula. */
export const aCursadaResumen = (i: InscripcionAlumno): CursadaResumen => ({
  cursoId: i.cursoId,
  asignatura: i.asignatura,
  periodo: i.periodo,
  notaFinal: i.notaFinal,
  estado: i.estado,
  enCurso: EN_CURSO.has(i.estado),
});

/** Inscripciones del alumno → historial, de la más reciente a la más antigua. */
export function aHistorial(inscripciones: InscripcionAlumno[]): CursadaResumen[] {
  return masRecientesPrimero(inscripciones).map(aCursadaResumen);
}
