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

  it('arma la oferta del período vigente filtrada por plan, según el contrato', async () => {
    let cursos: URL | undefined;
    e2e.server.use(
      http.get(RUTAS_ACADEMICO.CURSOS, ({ request }) => {
        cursos = new URL(request.url);
      }),
      ...academicoConFixtures(),
    );
    const res = await e2e.get('/inscripcion/oferta');
    expect(res.status).toBe(200);
    expect(contrato.validar('get', '/inscripcion/oferta', 200, res.body).errores).toEqual([]);
    const oferta = res.body as OfertaInscripcion;
    expect(oferta).toMatchObject({
      periodo: { id: '2027-1' },
      inscripcionAbierta: true,
      filtradaPorPlan: true,
    });
    expect(oferta.materias).toHaveLength(4);
    expect(cursos?.searchParams.get('periodoId')).toBe('2027-1');
    expect(cursos?.searchParams.get('planId')).toBe('plan-2020');
  });

  it('pide las inscripciones del alumno del token y marca dónde ya está inscripto', async () => {
    let alumno: unknown;
    e2e.server.use(
      http.get(RUTAS_ACADEMICO.INSCRIPCIONES, ({ params }) => {
        alumno = params.alumnoId;
      }),
      ...academicoConFixtures(),
    );
    const res = await e2e.get('/inscripcion/oferta?periodoId=2026-2');
    expect(alumno).toBe(ALUMNO);
    const estados = (res.body as OfertaInscripcion).materias.flatMap((m) =>
      m.comisiones.map((c) => c.estado),
    );
    expect(estados).toEqual(['INSCRIPTO', 'INSCRIPTO']);
  });

  it('bloquea las materias con correlativas faltantes', async () => {
    e2e.server.use(...academicoConFixtures());
    const res = await e2e.get('/inscripcion/oferta');
    const bloqueadas = (res.body as OfertaInscripcion).materias
      .filter((m) => m.bloqueada)
      .map((m) => m.asignatura.id);
    expect(bloqueadas).toEqual(['asig-bd2', 'asig-desa2']);
    expect(contrato.validar('get', '/inscripcion/oferta', 200, res.body).errores).toEqual([]);
  });

  // La caché vive mientras viva el BFF del test: cada caso usa una asignatura propia
  const unCurso = (asignaturaId: string) =>
    http.get(RUTAS_ACADEMICO.CURSOS, () =>
      HttpResponse.json([
        {
          id: `curso-${asignaturaId}`,
          cupoMaximo: 10,
          inscriptosActivos: 0,
          asignatura: { id: asignaturaId, nombre: asignaturaId },
        },
      ]),
    );

  it('una asignatura que el Módulo 9 no conoce no tiene correlativas', async () => {
    e2e.server.use(
      unCurso('asig-desconocida'),
      http.get(RUTAS_ACADEMICO.CORRELATIVIDADES, () => new HttpResponse(null, { status: 404 })),
      ...academicoConFixtures(),
    );
    const res = await e2e.get('/inscripcion/oferta');
    expect(res.status).toBe(200);
    expect((res.body as OfertaInscripcion).materias[0]).toMatchObject({ bloqueada: false });
  });

  it('las correlatividades se cachean entre requests', async () => {
    let pedidos = 0;
    e2e.server.use(
      unCurso('asig-cacheada'),
      http.get(RUTAS_ACADEMICO.CORRELATIVIDADES, () => {
        pedidos++;
        return HttpResponse.json([]);
      }),
      ...academicoConFixtures(),
    );
    await e2e.get('/inscripcion/oferta');
    await e2e.get('/inscripcion/oferta');
    expect(pedidos).toBe(1);
  });

  it('si fallan las correlatividades, falla la oferta (no se ofrece sin validar)', async () => {
    e2e.server.use(
      unCurso('asig-sin-correlativas'),
      http.get(RUTAS_ACADEMICO.CORRELATIVIDADES, () => new HttpResponse(null, { status: 503 })),
      ...academicoConFixtures(),
    );
    const res = await e2e.get('/inscripcion/oferta');
    expect(res.status).toBe(503);
    expect(cuerpo(res)).toMatchObject({ modulo: 'GESTION_ACADEMICA' });
  });

  it('fuera de la ventana devuelve la oferta con inscripcionAbierta false', async () => {
    e2e.server.use(...academicoConFixtures());
    const res = await e2e.get('/inscripcion/oferta?periodoId=2026-2');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      inscripcionHasta: '2026-07-31T02:59:59.000Z',
      inscripcionAbierta: false,
    });
    expect((res.body as OfertaInscripcion).materias.length).toBeGreaterThan(0);
  });

  it('con periodoId, la oferta de ese período', async () => {
    e2e.server.use(...academicoConFixtures());
    const res = await e2e.get('/inscripcion/oferta?periodoId=2026-2');
    expect(res.status).toBe(200);
    expect((res.body as OfertaInscripcion).periodo.id).toBe('2026-2');
  });

  it('un período inexistente es 404 PERIODO_NO_ENCONTRADO', async () => {
    e2e.server.use(...academicoConFixtures());
    const res = await e2e.get('/inscripcion/oferta?periodoId=1999-1');
    expect(res.status).toBe(404);
    expect(cuerpo(res)).toMatchObject({ code: 'PERIODO_NO_ENCONTRADO' });
    expect(contrato.validar('get', '/inscripcion/oferta', 404, cuerpo(res)).errores).toEqual([]);
  });

  it.each([
    ['Backoffice devuelve planId null', HttpResponse.json({ ...USUARIO_CON_PLAN, planId: null })],
    ['Backoffice no informa planId', HttpResponse.json({ email: 'v.moreno@uade.edu.ar' })],
    ['Backoffice está caído', new HttpResponse(null, { status: 503 })],
  ])('%s: pide la oferta sin filtrar por plan y lo informa', async (_caso, respuesta) => {
    let cursos: URL | undefined;
    e2e.server.use(
      http.get(RUTAS_ACADEMICO.USUARIO, () => respuesta),
      http.get(RUTAS_ACADEMICO.CURSOS, ({ request }) => {
        cursos = new URL(request.url);
      }),
      ...academicoConFixtures(),
    );
    const res = await e2e.get('/inscripcion/oferta');
    expect(res.status).toBe(200);
    expect((res.body as OfertaInscripcion).filtradaPorPlan).toBe(false);
    expect(cursos?.searchParams.has('planId')).toBe(false);
    expect(contrato.validar('get', '/inscripcion/oferta', 200, res.body).errores).toEqual([]);
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
