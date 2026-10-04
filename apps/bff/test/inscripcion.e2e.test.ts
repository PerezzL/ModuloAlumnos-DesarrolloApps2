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
