import { Contrato } from '@uadenet/contrato';
import type { CursadaResumen } from '@uadenet/api-types';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { RUTAS_ACADEMICO } from './academico-gateway';
import { ALUMNO, cuerpo, prepararE2E } from './app-e2e';
import { docenteConFixtures, RUTAS_DOCENTE } from './docente-gateway';
import { fixture } from './fixtures';

const contrato = new Contrato();
const inscripciones = fixture<object[]>('academic/inscripciones-alumno.provisional.json');

describe('GET /cursadas', () => {
  const e2e = prepararE2E();

  it('devuelve el historial del alumno del token según el contrato', async () => {
    let pedido: { alumnoId?: unknown; periodoId?: string | null } = {};
    e2e.server.use(
      http.get(RUTAS_ACADEMICO.INSCRIPCIONES, ({ params, request }) => {
        pedido = {
          alumnoId: params.alumnoId,
          periodoId: new URL(request.url).searchParams.get('periodoId'),
        };
        return HttpResponse.json(inscripciones);
      }),
      ...docenteConFixtures(),
    );
    const res = await e2e.get('/cursadas');
    expect(res.status).toBe(200);
    expect(contrato.validar('get', '/cursadas', 200, res.body).errores).toEqual([]);
    const { items } = res.body as { items: CursadaResumen[] };
    expect(items).toHaveLength(6);
    expect(items.filter((c) => c.enCurso).map((c) => c.asignatura.nombre)).toEqual([
      'Desarrollo de Aplicaciones I',
      'Bases de Datos I',
    ]);
    expect(pedido).toEqual({ alumnoId: ALUMNO, periodoId: null });
    expect((res.body as { fuentesConError: unknown }).fuentesConError).toEqual([]);
  });

  it('la nota final sale de los resultados de actas del Módulo 2, en un solo pedido', async () => {
    let pedidos = 0;
    e2e.server.use(
      http.get(RUTAS_ACADEMICO.INSCRIPCIONES, () => HttpResponse.json(inscripciones)),
      http.get(RUTAS_DOCENTE.RESULTADOS, ({ params, request }) => {
        pedidos++;
        expect(params.alumnoId).toBe(ALUMNO);
        expect(new URL(request.url).searchParams.has('courseId')).toBe(false);
        return HttpResponse.json([{ courseId: 'curso-discreta-2025-2-a', grade: 10 }]);
      }),
    );
    const { items } = (await e2e.get('/cursadas')).body as { items: CursadaResumen[] };
    expect(pedidos).toBe(1);
    expect(items.find((c) => c.cursoId === 'curso-discreta-2025-2-a')?.notaFinal).toBe(10);
    expect(items.find((c) => c.cursoId === 'curso-prog1-2025-2-a')?.notaFinal).toBeNull();
  });

  it.each([503, 504, 502])(
    'Módulo 2 %i: el historial sale igual, sin notas finales y con DOCENTE en fuentesConError',
    async (status) => {
      e2e.server.use(
        http.get(RUTAS_ACADEMICO.INSCRIPCIONES, () => HttpResponse.json(inscripciones)),
        http.get(RUTAS_DOCENTE.RESULTADOS, () => new HttpResponse(null, { status })),
      );
      const res = await e2e.get('/cursadas');
      expect(res.status).toBe(200);
      expect(contrato.validar('get', '/cursadas', 200, res.body).errores).toEqual([]);
      const body = res.body as { items: CursadaResumen[]; fuentesConError: string[] };
      expect(body.items).toHaveLength(6);
      expect(body.items.every((c) => c.notaFinal === null)).toBe(true);
      expect(body.fuentesConError).toEqual(['DOCENTE']);
    },
  );

  it('con periodoId, se lo pasa al Módulo 9', async () => {
    let periodoId: string | null = null;
    e2e.server.use(
      http.get(RUTAS_ACADEMICO.INSCRIPCIONES, ({ request }) => {
        periodoId = new URL(request.url).searchParams.get('periodoId');
        return HttpResponse.json([]);
      }),
      ...docenteConFixtures(),
    );
    const res = await e2e.get('/cursadas?periodoId=2026-2');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], fuentesConError: [] });
    expect(periodoId).toBe('2026-2');
  });

  it('un periodoId vacío es 400', async () => {
    const res = await e2e.get('/cursadas?periodoId=');
    expect(res.status).toBe(400);
    expect(cuerpo(res)).toMatchObject({ code: 'SOLICITUD_INVALIDA' });
    expect(contrato.validar('get', '/cursadas', 400, cuerpo(res)).errores).toEqual([]);
  });

  it.each([
    [503, 'UPSTREAM_UNAVAILABLE'],
    [502, 'UPSTREAM_INVALID'],
    [504, 'UPSTREAM_TIMEOUT'],
  ])('Gateway %i → %s de GESTION_ACADEMICA', async (status, code) => {
    e2e.server.use(
      http.get(RUTAS_ACADEMICO.INSCRIPCIONES, () => new HttpResponse(null, { status })),
      ...docenteConFixtures(),
    );
    const res = await e2e.get('/cursadas');
    expect(res.status).toBe(status);
    expect(cuerpo(res)).toMatchObject({ code, modulo: 'GESTION_ACADEMICA' });
    expect(contrato.validar('get', '/cursadas', status, cuerpo(res)).errores).toEqual([]);
  });
});
