import { Contrato } from '@uadenet/contrato';
import type { CursadaResumen } from '@uadenet/api-types';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { RUTAS_ACADEMICO } from './academico-gateway';
import { ALUMNO, cuerpo, prepararE2E } from './app-e2e';
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
  });

  it('con periodoId, se lo pasa al Módulo 9', async () => {
    let periodoId: string | null = null;
    e2e.server.use(
      http.get(RUTAS_ACADEMICO.INSCRIPCIONES, ({ request }) => {
        periodoId = new URL(request.url).searchParams.get('periodoId');
        return HttpResponse.json([]);
      }),
    );
    const res = await e2e.get('/cursadas?periodoId=2026-2');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
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
    );
    const res = await e2e.get('/cursadas');
    expect(res.status).toBe(status);
    expect(cuerpo(res)).toMatchObject({ code, modulo: 'GESTION_ACADEMICA' });
    expect(contrato.validar('get', '/cursadas', status, cuerpo(res)).errores).toEqual([]);
  });
});
