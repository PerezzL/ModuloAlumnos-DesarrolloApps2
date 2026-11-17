import { Contrato } from '@uadenet/contrato';
import type { OfertaInscripcion } from '@uadenet/api-types';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { academicoConFixtures, RUTAS_ACADEMICO, USUARIO_CON_PLAN } from './academico-gateway';
import { ALUMNO, cuerpo, prepararE2E } from './app-e2e';

const contrato = new Contrato();

describe('GET /inscripcion/oferta', () => {
  const e2e = prepararE2E();
  // Solo se congela la fecha: los timers reales siguen andando para Nest y msw
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-04T15:00:00Z'));
  });
  afterAll(() => vi.useRealTimers());

  it('arma la oferta del período vigente con los cursos del plan, según el contrato', async () => {
    let cursos: URL | undefined;
    let plan: unknown;
    e2e.server.use(
      http.get(RUTAS_ACADEMICO.CURSOS, ({ request }) => {
        cursos = new URL(request.url);
      }),
      http.get(RUTAS_ACADEMICO.ASIGNATURAS_PLAN, ({ params }) => {
        plan = params.planId;
      }),
      ...academicoConFixtures(),
    );
    const res = await e2e.get('/inscripcion/oferta');
    expect(res.status).toBe(200);
    expect(contrato.validar('get', '/inscripcion/oferta', 200, res.body).errores).toEqual([]);
    const oferta = res.body as OfertaInscripcion;
    expect(oferta).toMatchObject({
      periodo: { id: '4', nombre: '1° cuatrimestre 2027' },
      inscripcionDesde: '2026-09-28T00:00:00-03:00',
      inscripcionHasta: '2026-12-18T23:59:59.999-03:00',
      inscripcionAbierta: true,
      filtradaPorPlan: true,
    });
    // Sin la materia de otro plan (Contabilidad I) ni la comisión cancelada de Sistemas Operativos
    expect(oferta.materias.map((m) => m.asignatura.nombre)).toEqual([
      'Algoritmos y Estructuras de Datos',
      'Bases de Datos II',
      'Desarrollo de Aplicaciones II',
      'Sistemas Operativos',
    ]);
    expect(oferta.materias.at(-1)!.comisiones).toEqual([
      {
        cursoId: '1009',
        nombre: 'A - Noche',
        sede: 'Sede Monserrat',
        horarios: [{ dia: 'LUNES', desde: '18:30', hasta: '22:30', aula: 'Aula 501' }],
        cupoMaximo: 45,
        inscriptosActivos: 10,
        estado: 'CON_CUPO',
      },
    ]);
    expect(cursos?.searchParams.get('periodoId')).toBe('4');
    expect(cursos?.searchParams.has('planId')).toBe(false);
    expect(plan).toBe('12');
  });

  it('pide las inscripciones del alumno del token y marca dónde ya está inscripto', async () => {
    let alumno: unknown;
    e2e.server.use(
      http.get(RUTAS_ACADEMICO.INSCRIPCIONES, ({ params }) => {
        alumno = params.alumnoId;
      }),
      ...academicoConFixtures(),
    );
    const res = await e2e.get('/inscripcion/oferta?periodoId=3');
    expect(alumno).toBe(ALUMNO);
    const estados = (res.body as OfertaInscripcion).materias.flatMap((m) =>
      m.comisiones.map((c) => c.estado),
    );
    expect(estados).toEqual(['INSCRIPTO', 'INSCRIPTO']);
  });

  it('bloquea las materias con correlativas faltantes', async () => {
    e2e.server.use(...academicoConFixtures());
    const res = await e2e.get('/inscripcion/oferta');
    const materias = (res.body as OfertaInscripcion).materias.filter((m) => m.bloqueada);
    expect(materias.map((m) => m.asignatura.id)).toEqual(['109', '108']);
    expect(materias[1]!.correlativasFaltantes).toEqual([
      { asignaturaId: '106', nombre: 'Desarrollo de Aplicaciones I', tipo: 'REGULAR' },
    ]);
    expect(contrato.validar('get', '/inscripcion/oferta', 200, res.body).errores).toEqual([]);
  });

  // La caché vive mientras viva el BFF del test: cada caso usa una asignatura del plan cuyas
  // correlatividades todavía no se pidieron
  const unCurso = (asignaturaId: number) =>
    http.get(RUTAS_ACADEMICO.CURSOS, () =>
      HttpResponse.json([
        {
          id: 9000 + asignaturaId,
          codigo: 'Z',
          asignaturaId,
          estado: 'PLANIFICADO',
          cupoMaximo: 10,
          inscriptosActivos: 0,
        },
      ]),
    );

  it('una asignatura que el Módulo 9 no conoce no tiene correlativas', async () => {
    e2e.server.use(
      unCurso(101),
      http.get(RUTAS_ACADEMICO.CORRELATIVIDADES, () => new HttpResponse(null, { status: 404 })),
      ...academicoConFixtures(),
    );
    const res = await e2e.get('/inscripcion/oferta');
    expect(res.status).toBe(200);
    expect((res.body as OfertaInscripcion).materias[0]).toMatchObject({ bloqueada: false });
  });

  it('las correlatividades y las materias del plan se cachean entre requests', async () => {
    let correlatividades = 0;
    let planes = 0;
    e2e.server.use(
      unCurso(102),
      http.get(RUTAS_ACADEMICO.CORRELATIVIDADES, () => {
        correlatividades++;
        return HttpResponse.json({ asignaturaId: 102, condiciones: [] });
      }),
      http.get(RUTAS_ACADEMICO.ASIGNATURAS_PLAN, () => {
        planes++;
      }),
      ...academicoConFixtures(),
    );
    await e2e.get('/inscripcion/oferta');
    await e2e.get('/inscripcion/oferta');
    expect(correlatividades).toBe(1);
    expect(planes).toBe(0);
  });

  it('si fallan las correlatividades, falla la oferta (no se ofrece sin validar)', async () => {
    e2e.server.use(
      unCurso(104),
      http.get(RUTAS_ACADEMICO.CORRELATIVIDADES, () => new HttpResponse(null, { status: 503 })),
      ...academicoConFixtures(),
    );
    const res = await e2e.get('/inscripcion/oferta');
    expect(res.status).toBe(503);
    expect(cuerpo(res)).toMatchObject({ modulo: 'GESTION_ACADEMICA' });
  });

  it('fuera de la ventana devuelve la oferta con inscripcionAbierta false', async () => {
    e2e.server.use(...academicoConFixtures());
    const res = await e2e.get('/inscripcion/oferta?periodoId=3');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      inscripcionHasta: '2026-07-30T23:59:59.999-03:00',
      inscripcionAbierta: false,
    });
    expect((res.body as OfertaInscripcion).materias.length).toBeGreaterThan(0);
  });

  it('con periodoId, la oferta de ese período', async () => {
    e2e.server.use(...academicoConFixtures());
    const res = await e2e.get('/inscripcion/oferta?periodoId=3');
    expect(res.status).toBe(200);
    expect((res.body as OfertaInscripcion).periodo.id).toBe('3');
  });

  it('un período inexistente es 404 PERIODO_NO_ENCONTRADO', async () => {
    e2e.server.use(...academicoConFixtures());
    const res = await e2e.get('/inscripcion/oferta?periodoId=1999-1');
    expect(res.status).toBe(404);
    expect(cuerpo(res)).toMatchObject({ code: 'PERIODO_NO_ENCONTRADO' });
    expect(contrato.validar('get', '/inscripcion/oferta', 404, cuerpo(res)).errores).toEqual([]);
  });

  it('una respuesta con la forma vieja del Módulo 9 es 502 de GESTION_ACADEMICA', async () => {
    e2e.server.use(
      http.get(RUTAS_ACADEMICO.PERIODOS, () =>
        HttpResponse.json([{ id: '2027-1', nombre: '1° cuatrimestre 2027' }]),
      ),
      ...academicoConFixtures(),
    );
    const res = await e2e.get('/inscripcion/oferta');
    expect(res.status).toBe(502);
    expect(cuerpo(res)).toMatchObject({ code: 'UPSTREAM_INVALID', modulo: 'GESTION_ACADEMICA' });
  });

  it.each([
    [
      'Backoffice no informa carreras',
      HttpResponse.json({ ...USUARIO_CON_PLAN, careers: [], careerId: null }),
    ],
    ['Backoffice no manda careers', HttpResponse.json({ email: 'v.moreno@uade.edu.ar' })],
    ['Backoffice está caído', new HttpResponse(null, { status: 503 })],
  ])(
    '%s y el token no trae carrera: oferta sin materias y lo informa',
    async (_caso, respuesta) => {
      let cursos = 0;
      e2e.server.use(
        http.get(RUTAS_ACADEMICO.USUARIO, () => respuesta),
        http.get(RUTAS_ACADEMICO.CURSOS, () => {
          cursos++;
        }),
        ...academicoConFixtures(),
      );
      const res = await e2e.get('/inscripcion/oferta');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ filtradaPorPlan: false, materias: [] });
      expect(cursos).toBe(0);
      expect(contrato.validar('get', '/inscripcion/oferta', 200, res.body).errores).toEqual([]);
    },
  );

  it('Backoffice sin plan pero con careerId: usa el plan activo de esa carrera', async () => {
    let plan: unknown;
    e2e.server.use(
      http.get(RUTAS_ACADEMICO.USUARIO, () =>
        HttpResponse.json({ ...USUARIO_CON_PLAN, careers: [], careerId: '3' }),
      ),
      http.get(RUTAS_ACADEMICO.ASIGNATURAS_PLAN, ({ params }) => {
        plan = params.planId;
      }),
      ...academicoConFixtures(),
    );
    const res = await e2e.get('/inscripcion/oferta');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ filtradaPorPlan: true });
    expect((res.body as OfertaInscripcion).materias).toHaveLength(4);
    // Las materias del plan 12 ya pueden estar cacheadas: si se pidieron, fue ese plan
    expect([undefined, '12']).toContain(plan);
  });

  it.each([
    [503, 'UPSTREAM_UNAVAILABLE'],
    [502, 'UPSTREAM_INVALID'],
    [504, 'UPSTREAM_TIMEOUT'],
  ])('Módulo 9 %i → %s de GESTION_ACADEMICA', async (status, code) => {
    e2e.server.use(
      http.get(RUTAS_ACADEMICO.PERIODOS, () => new HttpResponse(null, { status })),
      ...academicoConFixtures(),
    );
    const res = await e2e.get('/inscripcion/oferta');
    expect(res.status).toBe(status);
    expect(cuerpo(res)).toMatchObject({ code, modulo: 'GESTION_ACADEMICA' });
    expect(contrato.validar('get', '/inscripcion/oferta', status, cuerpo(res)).errores).toEqual([]);
  });
});

// Token de CORE con `careerIds`: si Backoffice no da el plan, se usa el plan activo de la carrera
describe('GET /inscripcion/oferta con la carrera en el token', () => {
  const e2e = prepararE2E({ claims: { careerIds: [3] } });
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-04T15:00:00Z'));
  });
  afterAll(() => vi.useRealTimers());

  // Va primero: el catálogo de carreras queda cacheado después del primer pedido que funciona
  it('si el catálogo de carreras falla, la oferta sale sin materias en lugar de fallar', async () => {
    e2e.server.use(
      http.get(RUTAS_ACADEMICO.USUARIO, () =>
        HttpResponse.json({ ...USUARIO_CON_PLAN, careers: [] }),
      ),
      http.get(RUTAS_ACADEMICO.CARRERAS_CON_PLAN, () => new HttpResponse(null, { status: 503 })),
      ...academicoConFixtures(),
    );
    const res = await e2e.get('/inscripcion/oferta');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ filtradaPorPlan: false, materias: [] });
  });

  it.each([
    ['Backoffice no informa el plan', HttpResponse.json({ ...USUARIO_CON_PLAN, careers: [] })],
    ['Backoffice está caído', new HttpResponse(null, { status: 503 })],
  ])('%s: usa el plan activo de la carrera en el Módulo 9', async (_caso, respuesta) => {
    e2e.server.use(
      http.get(RUTAS_ACADEMICO.USUARIO, () => respuesta),
      ...academicoConFixtures(),
    );
    const res = await e2e.get('/inscripcion/oferta');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ filtradaPorPlan: true });
    // Las cuatro materias del plan 12 (el activo de la carrera 3) en el período
    expect((res.body as OfertaInscripcion).materias).toHaveLength(4);
  });
});
