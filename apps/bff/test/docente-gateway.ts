import { http, HttpResponse } from 'msw';
import { GW } from './app-e2e';
import { fixture } from './fixtures';

const M2 = `${GW}/api/v1/teacher/cursos/:cursoId/alumnos/:alumnoId`;

/** Rutas del Módulo 2 detrás del Gateway simulado (supuestas: no hay contrato) */
export const RUTAS_DOCENTE = {
  ASISTENCIA: `${M2}/asistencia`,
} as const;

/** Fixture del Módulo 2 por curso; un curso sin datos es 404, como en el CORE falso */
const porCurso = (archivo: string, cursoId: unknown) => {
  const datos = fixture<Record<string, unknown>>(archivo);
  const id = String(cursoId);
  return Object.hasOwn(datos, id)
    ? HttpResponse.json(datos[id] as object)
    : HttpResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
};

/** Módulo 2 respondiendo con sus fixtures para cualquier alumno */
export function docenteConFixtures() {
  return [
    http.get(RUTAS_DOCENTE.ASISTENCIA, ({ params }) =>
      porCurso('teacher/asistencia.provisional.json', params.cursoId),
    ),
  ];
}
