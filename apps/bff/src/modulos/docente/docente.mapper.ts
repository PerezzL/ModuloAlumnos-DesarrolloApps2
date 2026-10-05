import type { Asistencia, NotaResumen } from '@uadenet/api-types';
import type { z } from 'zod';
import { idOpaco, parsearOrigen } from '../comun';
import type { NotaConDocente } from './docente.modelo';
import { AsistenciaAlumno, Nota, Notas } from './docente.origen';

/**
 * Asistencia del alumno en el curso. Límite y faltas restantes pasan tal como llegan: si el
 * Módulo 2 no los informa quedan en null y el portal no los calcula. Las clases, por fecha.
 */
export function aAsistencia(datos: unknown): Asistencia {
  const a = parsearOrigen('DOCENTE', AsistenciaAlumno, datos);
  return {
    clasesDictadas: a.clasesDictadas,
    presentes: a.presentes,
    ausentes: a.ausentes,
    porcentaje: a.porcentaje,
    limiteInasistencias: a.limiteInasistencias ?? null,
    inasistenciasRestantes: a.inasistenciasRestantes ?? null,
    clases: (a.clases ?? [])
      .map((c) => ({ fecha: c.fecha, presente: c.presente }))
      .sort((x, y) => x.fecha.localeCompare(y.fecha)),
  };
}

/** El `examId` del Módulo 2 es nuestro `notaId`. Sin nota todavía, sin `resultado`. */
const aNotaResumen = (n: z.infer<typeof Nota>): NotaResumen => ({
  notaId: idOpaco(n.examId),
  instancia: n.instancia,
  ...(n.titulo !== undefined && { titulo: n.titulo }),
  ...(n.fecha !== undefined && { fecha: n.fecha }),
  nota: n.nota ?? null,
  ...(n.resultado != null && { resultado: n.resultado }),
});

/** Notas del alumno en el curso, en el orden en que las da el Módulo 2 */
export function aNotas(datos: unknown): NotaResumen[] {
  return parsearOrigen('DOCENTE', Notas, datos).map(aNotaResumen);
}

/** Una nota con lo que solo va en el detalle: docente y observaciones, si el Módulo 2 las da */
export function aNotaConDocente(datos: unknown): NotaConDocente {
  const n = parsearOrigen('DOCENTE', Nota, datos);
  return {
    ...aNotaResumen(n),
    docente: n.docente ?? null,
    observaciones: n.observaciones ?? null,
  };
}
