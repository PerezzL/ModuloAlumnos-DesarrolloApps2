import { http, HttpResponse } from 'msw';
import { ALUMNO, GW } from './app-e2e';
import { fixture } from './fixtures';

const M9 = `${GW}/api/v1/academic`;

/** Rutas del Módulo 9 y de Backoffice detrás del Gateway simulado */
export const RUTAS_ACADEMICO = {
  PERIODOS: `${M9}/planificacion/periodos`,
  CURSOS: `${M9}/planificacion/cursos`,
  CARRERAS: `${M9}/academica/carreras`,
  CORRELATIVIDADES: `${M9}/academica/asignaturas/:asignaturaId/correlatividades`,
  INSCRIPCIONES: `${M9}/planificacion/alumnos/:alumnoId/inscripciones`,
  INSCRIBIR: `${M9}/planificacion/cursos/:cursoId/inscripciones`,
  USUARIO: `${GW}/api/v1/backoffice/users/${ALUMNO}`,
} as const;

const usuarios = fixture<Record<string, Record<string, unknown>>>(
  'backoffice/users.provisional.json',
);
export const USUARIO_CON_PLAN = Object.values(usuarios)[0]!;

/** Backoffice y Módulo 9 respondiendo con sus fixtures. Los cursos se filtran por período. */
export function academicoConFixtures() {
  return [
    http.get(RUTAS_ACADEMICO.USUARIO, () => HttpResponse.json(USUARIO_CON_PLAN)),
    http.get(RUTAS_ACADEMICO.PERIODOS, () =>
      HttpResponse.json(fixture('academic/periodos.provisional.json')),
    ),
    http.get(RUTAS_ACADEMICO.CURSOS, ({ request }) => {
      const periodoId = new URL(request.url).searchParams.get('periodoId');
      const cursos = fixture<{ periodoId: string }[]>('academic/cursos.provisional.json');
      return HttpResponse.json(cursos.filter((c) => c.periodoId === periodoId));
    }),
    http.get(RUTAS_ACADEMICO.CORRELATIVIDADES, ({ params }) => {
      const todas = fixture<Record<string, object>>('academic/correlatividades.provisional.json');
      const id = String(params.asignaturaId);
      return Object.hasOwn(todas, id)
        ? HttpResponse.json(todas[id])
        : HttpResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
    }),
    http.get(RUTAS_ACADEMICO.INSCRIPCIONES, () =>
      HttpResponse.json(fixture('academic/inscripciones-alumno.provisional.json')),
    ),
  ];
}
