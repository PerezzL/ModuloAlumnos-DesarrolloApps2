import type { Asistencia, InstanciaExamen, NotaResumen } from '@uadenet/api-types';
import type { z } from 'zod';
import { idOpaco, parsearOrigen } from '../comun';
import type { NotaConDocente, NotasCurso } from './docente.modelo';
import { AsistenciaAlumno, ExamenAlumno, NotasAlumno, ResultadosAlumno } from './docente.origen';

/**
 * Asistencia del alumno en el curso. Porcentaje, mínimo y condición pasan tal como llegan: el
 * portal no los calcula. Las clases, por fecha.
 */
export function aAsistencia(datos: unknown): Asistencia {
  const a = parsearOrigen('DOCENTE', AsistenciaAlumno, datos);
  return {
    clasesDictadas: a.classesRecorded,
    presentes: a.present,
    justificadas: a.justified,
    ausentes: a.absences,
    porcentaje: a.attendancePercentage,
    porcentajeMinimo: a.threshold,
    condicion: a.condition,
    clases: a.classes
      .map((c) => ({ fecha: c.date, estado: c.status ?? null, comentario: c.note ?? null }))
      .sort((x, y) => x.fecha.localeCompare(y.fecha)),
  };
}

const INSTANCIAS: ReadonlySet<string> = new Set<InstanciaExamen>([
  'PARCIAL',
  'RECUPERATORIO',
  'INTEGRADOR',
  'FINAL',
]);

/** La categoría del examen, si es una de las nuestras. El catálogo puede crecer: si no, null. */
const instancia = (categoria: string | null | undefined) =>
  categoria != null && INSTANCIAS.has(categoria) ? (categoria as InstanciaExamen) : null;

/** El resultado, solo si el Módulo 2 lo informa: ausente, o aprobado/desaprobado por `passed`. */
function resultado(e: z.infer<typeof ExamenAlumno>): NotaResumen['resultado'] {
  if (e.absent) return 'AUSENTE';
  if (e.passed == null) return undefined;
  return e.passed ? 'APROBADO' : 'DESAPROBADO';
}

/** El `examId` del Módulo 2 es nuestro `notaId`. Sin nota todavía, sin `resultado`. */
function aNota(e: z.infer<typeof ExamenAlumno>): NotaConDocente {
  const r = resultado(e);
  return {
    notaId: idOpaco(e.examId),
    instancia: instancia(e.category),
    titulo: e.name,
    fecha: e.date,
    nota: e.grade ?? null,
    ...(r !== undefined && { resultado: r }),
    docenteId: e.gradedBy ?? null,
  };
}

/** Notas del alumno en el curso, en el orden en que las da el Módulo 2, sin las canceladas. */
export function aNotasCurso(datos: unknown): NotasCurso {
  const n = parsearOrigen('DOCENTE', NotasAlumno, datos);
  return {
    notas: n.exams.filter((e) => e.status !== 'CANCELADO').map(aNota),
    promedio: n.average ?? null,
  };
}

/** Resultados de actas del alumno → nota final por curso (null si el acta no tiene nota). */
export function aNotasFinales(datos: unknown): ReadonlyMap<string, number | null> {
  return new Map(
    parsearOrigen('DOCENTE', ResultadosAlumno, datos).map((r) => [
      idOpaco(r.courseId),
      r.grade ?? null,
    ]),
  );
}
