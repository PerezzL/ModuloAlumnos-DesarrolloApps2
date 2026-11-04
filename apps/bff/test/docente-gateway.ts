import { http, HttpResponse } from 'msw';
import { GW } from './app-e2e';
import { fixture } from './fixtures';

const M2 = `${GW}/api/v1/teacher/students/:alumnoId`;

/** Rutas por alumno del Módulo 2 detrás del Gateway simulado, y la ficha de un docente */
export const RUTAS_DOCENTE = {
  ASISTENCIA: `${M2}/courses/:cursoId/attendance`,
  NOTAS: `${M2}/courses/:cursoId/grades`,
  RESULTADOS: `${M2}/results`,
  USUARIO: `${GW}/api/v1/backoffice/users/:userId`,
} as const;

/** Fixture del Módulo 2 por curso; un curso sin datos es 404, como en el CORE falso */
const porCurso = (archivo: string, cursoId: unknown) => {
  const datos = fixture<Record<string, unknown>>(archivo);
  const id = String(cursoId);
  return Object.hasOwn(datos, id)
    ? HttpResponse.json(datos[id] as object)
    : HttpResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
};

/** Resultados de actas del alumno de las fixtures, filtrados por `courseId` si viene */
export const resultados = (courseId?: string | null) => {
  const todos = Object.values(
    fixture<Record<string, { courseId: string }[]>>('teacher/results.json'),
  )[0]!;
  return courseId ? todos.filter((r) => r.courseId === courseId) : todos;
};

/** Módulo 2 y Backoffice (fichas de docentes) respondiendo con sus fixtures */
export function docenteConFixtures() {
  return [
    http.get(RUTAS_DOCENTE.ASISTENCIA, ({ params }) =>
      porCurso('teacher/attendance.json', params.cursoId),
    ),
    http.get(RUTAS_DOCENTE.NOTAS, ({ params }) => porCurso('teacher/grades.json', params.cursoId)),
    http.get(RUTAS_DOCENTE.RESULTADOS, ({ request }) =>
      HttpResponse.json(resultados(new URL(request.url).searchParams.get('courseId'))),
    ),
    http.get(RUTAS_DOCENTE.USUARIO, ({ params }) =>
      porCurso('backoffice/users.provisional.json', params.userId),
    ),
  ];
}
