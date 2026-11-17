import { http, HttpResponse } from 'msw';
import { ALUMNO, GW } from './app-e2e';
import { fixture } from './fixtures';

const M9 = `${GW}/api/v1/academic`;

/** Rutas del Módulo 9 y de Backoffice detrás del Gateway simulado */
export const RUTAS_ACADEMICO = {
  PERIODOS: `${M9}/planificacion/periodos`,
  CURSOS: `${M9}/planificacion/cursos`,
  ASIGNATURAS_PLAN: `${M9}/academica/planes/:planId/asignaturas`,
  CARRERAS: `${M9}/academica/carreras`,
  CARRERAS_CON_PLAN: `${M9}/academica/carreras/con-ultimo-plan-activo`,
  CORRELATIVIDADES: `${M9}/academica/asignaturas/:asignaturaId/correlatividades`,
  INSCRIPCIONES: `${M9}/planificacion/alumnos/:alumnoId/inscripciones`,
  INSCRIBIR: `${M9}/planificacion/cursos/:cursoId/inscripciones`,
  USUARIO: `${GW}/api/v1/backoffice/users/${ALUMNO}`,
} as const;

const usuarios = fixture<Record<string, Record<string, unknown>>>(
  'backoffice/users.provisional.json',
);
export const USUARIO_CON_PLAN = Object.values(usuarios)[0]!;

/**
 * Backoffice y Módulo 9 respondiendo con sus fixtures. Los cursos se filtran por período,
 * como el Módulo 9 (no filtra por plan).
 */
export function academicoConFixtures() {
  return [
    http.get(RUTAS_ACADEMICO.USUARIO, () => HttpResponse.json(USUARIO_CON_PLAN)),
    http.get(RUTAS_ACADEMICO.PERIODOS, () =>
      HttpResponse.json(fixture('academic/periodos.provisional.json')),
    ),
    http.get(RUTAS_ACADEMICO.CURSOS, ({ request }) => {
      const periodoId = new URL(request.url).searchParams.get('periodoId');
      const cursos = fixture<{ periodoId: number }[]>('academic/cursos.provisional.json');
      return HttpResponse.json(cursos.filter((c) => String(c.periodoId) === periodoId));
    }),
    http.get(RUTAS_ACADEMICO.ASIGNATURAS_PLAN, ({ params }) => {
      const planes = fixture<Record<string, object>>(
        'academic/planes-asignaturas.provisional.json',
      );
      const id = String(params.planId);
      return Object.hasOwn(planes, id)
        ? HttpResponse.json(planes[id])
        : HttpResponse.json({ code: 'RESOURCE_NOT_FOUND' }, { status: 404 });
    }),
    http.get(RUTAS_ACADEMICO.CARRERAS_CON_PLAN, () =>
      HttpResponse.json(fixture('academic/carreras.provisional.json')),
    ),
    http.get(RUTAS_ACADEMICO.CORRELATIVIDADES, ({ params }) => {
      const todas = fixture<Record<string, object>>('academic/correlatividades.provisional.json');
      const id = String(params.asignaturaId);
      return Object.hasOwn(todas, id)
        ? HttpResponse.json(todas[id])
        : HttpResponse.json({ code: 'RESOURCE_NOT_FOUND' }, { status: 404 });
    }),
    http.get(RUTAS_ACADEMICO.INSCRIPCIONES, () =>
      HttpResponse.json(fixture('academic/inscripciones-alumno.provisional.json')),
    ),
  ];
}
