import { Contrato } from '@uadenet/contrato';
import type { CursadaDetalle } from '@uadenet/api-types';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { RUTAS_ACADEMICO } from './academico-gateway';
import { ALUMNO, cuerpo, prepararE2E } from './app-e2e';
import { docenteConFixtures, RUTAS_DOCENTE } from './docente-gateway';
import { fixture } from './fixtures';

const contrato = new Contrato();
const inscripciones = fixture<object[]>('academic/inscripciones-alumno.provisional.json');
const moduloNueve = () =>
  http.get(RUTAS_ACADEMICO.INSCRIPCIONES, () => HttpResponse.json(inscripciones));
const moduloDosCaido = (status: number) => [
  http.get(RUTAS_DOCENTE.ASISTENCIA, () => new HttpResponse(null, { status })),
  http.get(RUTAS_DOCENTE.NOTAS, () => new HttpResponse(null, { status })),
  http.get(RUTAS_DOCENTE.RESULTADOS, () => new HttpResponse(null, { status })),
];

const validar = (status: number, body: unknown) =>
  expect(contrato.validar('get', '/cursadas/{cursoId}', status, body).errores).toEqual([]);

describe('GET /cursadas/{cursoId}', () => {
  const e2e = prepararE2E();

  it('encabezado con materia, comisión, período y situación del Módulo 9', async () => {
    e2e.server.use(moduloNueve(), ...docenteConFixtures());
    const res = await e2e.get('/cursadas/curso-bd1-2026-2-a');
    expect(res.status).toBe(200);
    validar(200, res.body);
    expect(res.body).toMatchObject({
      cursoId: 'curso-bd1-2026-2-a',
      asignatura: { nombre: 'Bases de Datos I' },
      periodo: { nombre: '2° cuatrimestre 2026' },
      comision: 'A - Noche',
      estado: 'CURSANDO',
      enCurso: true,
      notaFinal: null,
    });
  });

  it('asistencia del Módulo 2 para el alumno del token, con mínimo y condición', async () => {
    let pedido: Record<string, unknown> = {};
    e2e.server.use(
      moduloNueve(),
      http.get(RUTAS_DOCENTE.ASISTENCIA, ({ params }) => {
        pedido = { ...params };
        return HttpResponse.json(
          fixture<Record<string, object>>('teacher/attendance.json')['curso-bd1-2026-2-a'],
        );
      }),
      ...docenteConFixtures(),
    );
    const res = await e2e.get('/cursadas/curso-bd1-2026-2-a');
    validar(200, res.body);
    expect((res.body as CursadaDetalle).asistencia).toMatchObject({
      clasesDictadas: 8,
      presentes: 5,
      justificadas: 1,
      ausentes: 2,
      porcentaje: 75,
      porcentajeMinimo: 75,
      condicion: 'REGULAR',
    });
    expect(pedido).toEqual({ cursoId: 'curso-bd1-2026-2-a', alumnoId: ALUMNO });
  });

  it('notas del Módulo 2 sin las canceladas, con su notaId y el promedio', async () => {
    e2e.server.use(moduloNueve(), ...docenteConFixtures());
    const res = await e2e.get('/cursadas/curso-desa1-2026-2-a');
    validar(200, res.body);
    const { notas, promedio } = res.body as CursadaDetalle;
    expect(notas?.map((n) => [n.notaId, n.instancia, n.nota, n.resultado])).toEqual([
      ['201', 'PARCIAL', 3.5, 'DESAPROBADO'],
      ['202', 'RECUPERATORIO', 8, 'APROBADO'],
      ['204', null, null, 'AUSENTE'],
    ]);
    expect(notas?.[0]).not.toHaveProperty('docenteId');
    expect(promedio).toBe(5.75);
  });

  it('la nota final sale de los resultados de actas del Módulo 2 para ese curso', async () => {
    let courseId: string | null = null;
    e2e.server.use(
      moduloNueve(),
      http.get(RUTAS_DOCENTE.RESULTADOS, ({ request, params }) => {
        expect(params.alumnoId).toBe(ALUMNO);
        courseId = new URL(request.url).searchParams.get('courseId');
        return HttpResponse.json([{ courseId, grade: 9, result: 'APROBADO' }]);
      }),
      ...docenteConFixtures(),
    );
    const res = await e2e.get('/cursadas/curso-bd1-2026-2-a');
    expect(res.body).toMatchObject({ notaFinal: 9 });
    expect(courseId).toBe('curso-bd1-2026-2-a');
  });

  it('un curso en el que el alumno no está inscripto es 404', async () => {
    e2e.server.use(moduloNueve(), ...docenteConFixtures());
    const res = await e2e.get('/cursadas/curso-de-otro');
    expect(res.status).toBe(404);
    expect(cuerpo(res)).toMatchObject({ code: 'CURSADA_NO_ENCONTRADA' });
    validar(404, cuerpo(res));
  });

  it('si falla el Módulo 9, falla todo el detalle', async () => {
    e2e.server.use(
      http.get(RUTAS_ACADEMICO.INSCRIPCIONES, () => new HttpResponse(null, { status: 503 })),
      ...docenteConFixtures(),
    );
    const res = await e2e.get('/cursadas/curso-bd1-2026-2-a');
    expect(res.status).toBe(503);
    expect(cuerpo(res)).toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
      modulo: 'GESTION_ACADEMICA',
    });
    validar(503, cuerpo(res));
  });

  it('sin fallas, fuentesConError vacío', async () => {
    e2e.server.use(moduloNueve(), ...docenteConFixtures());
    const res = await e2e.get('/cursadas/curso-bd1-2026-2-a');
    expect((res.body as CursadaDetalle).fuentesConError).toEqual([]);
  });

  it.each([
    [503, 'caído'],
    [504, 'timeout'],
    [502, 'respuesta inválida'],
  ])(
    'Módulo 2 %i (%s): 200 con asistencia, notas y nota final en null y DOCENTE en fuentesConError',
    async (status) => {
      e2e.server.use(moduloNueve(), ...moduloDosCaido(status));
      const res = await e2e.get('/cursadas/curso-bd1-2026-2-a');
      expect(res.status).toBe(200);
      validar(200, res.body);
      expect(res.body).toMatchObject({
        cursoId: 'curso-bd1-2026-2-a',
        estado: 'CURSANDO',
        asistencia: null,
        notas: null,
        promedio: null,
        notaFinal: null,
        fuentesConError: ['DOCENTE'],
      });
    },
  );

  it('Módulo 2 que no contesta antes del timeout del Gateway: igual que caído', async () => {
    e2e.server.use(
      moduloNueve(),
      http.get(RUTAS_DOCENTE.ASISTENCIA, () => new Promise(() => undefined)),
      http.get(RUTAS_DOCENTE.NOTAS, () => new Promise(() => undefined)),
      ...docenteConFixtures(),
    );
    const res = await e2e.get('/cursadas/curso-bd1-2026-2-a');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ asistencia: null, notas: null, fuentesConError: ['DOCENTE'] });
  });

  it('una respuesta del Módulo 2 con forma inesperada cuenta como falla de DOCENTE', async () => {
    e2e.server.use(
      moduloNueve(),
      http.get(RUTAS_DOCENTE.ASISTENCIA, () => HttpResponse.json({ present: 'muchos' })),
      ...docenteConFixtures(),
    );
    const res = await e2e.get('/cursadas/curso-bd1-2026-2-a');
    validar(200, res.body);
    expect(res.body).toMatchObject({ asistencia: null, fuentesConError: ['DOCENTE'] });
    expect((res.body as CursadaDetalle).notas).toHaveLength(3);
  });

  it('si falla solo notas, la asistencia sale igual', async () => {
    e2e.server.use(
      moduloNueve(),
      http.get(RUTAS_DOCENTE.NOTAS, () => new HttpResponse(null, { status: 503 })),
      ...docenteConFixtures(),
    );
    const res = await e2e.get('/cursadas/curso-bd1-2026-2-a');
    validar(200, res.body);
    expect(res.body).toMatchObject({
      asistencia: { clasesDictadas: 8 },
      notas: null,
      fuentesConError: ['DOCENTE'],
    });
  });

  it('un 404 del Módulo 2 para un curso que el Módulo 9 sí tiene es falla de DOCENTE, no vacío', async () => {
    e2e.server.use(moduloNueve(), ...docenteConFixtures());
    const res = await e2e.get('/cursadas/curso-prog1-2025-2-a');
    validar(200, res.body);
    expect(res.body).toMatchObject({
      asistencia: null,
      notas: null,
      notaFinal: 8,
      fuentesConError: ['DOCENTE'],
    });
  });

  it('si fallan los dos módulos, manda el error del Módulo 9', async () => {
    e2e.server.use(
      http.get(RUTAS_ACADEMICO.INSCRIPCIONES, () => new HttpResponse(null, { status: 504 })),
      ...moduloDosCaido(503),
    );
    const res = await e2e.get('/cursadas/curso-bd1-2026-2-a');
    expect(res.status).toBe(504);
    expect(cuerpo(res)).toMatchObject({ code: 'UPSTREAM_TIMEOUT', modulo: 'GESTION_ACADEMICA' });
  });
});
