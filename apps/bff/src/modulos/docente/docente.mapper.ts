import type { Asistencia } from '@uadenet/api-types';
import { parsearOrigen } from '../comun';
import { AsistenciaAlumno } from './docente.origen';

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
