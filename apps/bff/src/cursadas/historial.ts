import type { CursadaResumen } from '@uadenet/api-types';
import type { InscripcionAlumno } from '../modulos/academico/academico.modelo';

const EN_CURSO: ReadonlySet<CursadaResumen['estado']> = new Set(['INSCRIPTO', 'CURSANDO']);

/** Compara fechas `YYYY-MM-DD`, más reciente primero; sin fecha, al final */
const masReciente = (a?: string, b?: string) =>
  a === b ? 0 : a === undefined ? 1 : b === undefined ? -1 : b.localeCompare(a);

/**
 * De la más reciente a la más antigua: por inicio del período y, dentro del mismo período,
 * por fecha de inscripción (los ids son opacos: no se ordenan). Sin fechas, van al final en
 * el orden en que llegaron.
 */
export const masRecientesPrimero = (inscripciones: InscripcionAlumno[]) =>
  [...inscripciones].sort(
    (a, b) => masReciente(a.inicioPeriodo, b.inicioPeriodo) || masReciente(a.fecha, b.fecha),
  );

/**
 * Una inscripción como cursada. La situación es la del Módulo 9 y la nota final, la del acta
 * del Módulo 2: el portal no calcula ninguna de las dos.
 */
export const aCursadaResumen = (
  i: InscripcionAlumno,
  notaFinal: number | null,
): CursadaResumen => ({
  cursoId: i.cursoId,
  asignatura: i.asignatura,
  periodo: i.periodo,
  notaFinal,
  estado: i.estado,
  enCurso: EN_CURSO.has(i.estado),
});

/**
 * Inscripciones del alumno y notas finales por curso → historial, de la más reciente a la más
 * antigua. Sin notas finales (el Módulo 2 no respondió), todas quedan en null.
 */
export function aHistorial(
  inscripciones: InscripcionAlumno[],
  notasFinales: ReadonlyMap<string, number | null> | null,
): CursadaResumen[] {
  return masRecientesPrimero(inscripciones).map((i) =>
    aCursadaResumen(i, notasFinales?.get(i.cursoId) ?? null),
  );
}
