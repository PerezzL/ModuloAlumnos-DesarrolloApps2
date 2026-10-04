import { Contrato } from '@uadenet/contrato';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { RUTAS_ACADEMICO } from './academico-gateway';
import { ALUMNO, cuerpo, prepararE2E } from './app-e2e';
import { fixture } from './fixtures';

const contrato = new Contrato();
const creada = fixture<object>('academic/inscripcion-creada.provisional.json');

describe('POST /inscripciones', () => {
  const e2e = prepararE2E();

  it('comanda la inscripción con el alumno del token y responde 201 según el contrato', async () => {
    let pedido: { cursoId?: unknown; body?: unknown; auth?: string | null } = {};
    e2e.server.use(
      http.post(RUTAS_ACADEMICO.INSCRIBIR, async ({ params, request }) => {
        pedido = {
          cursoId: params.cursoId,
          body: await request.json(),
          auth: request.headers.get('authorization'),
        };
        return HttpResponse.json(creada, { status: 201 });
      }),
    );
    const res = await e2e.post('/inscripciones', { cursoId: 'curso-so-2027-1-a' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ cursoId: 'curso-so-2027-1-a', estado: 'INSCRIPTO' });
    expect(contrato.validar('post', '/inscripciones', 201, res.body).errores).toEqual([]);
    expect(pedido).toEqual({
      cursoId: 'curso-so-2027-1-a',
      body: { alumnoId: ALUMNO },
      auth: `Bearer ${e2e.token}`,
    });
  });

  it('ignora un alumnoId en el cuerpo: el alumno es siempre el del token', async () => {
    let body: unknown;
    e2e.server.use(
      http.post(RUTAS_ACADEMICO.INSCRIBIR, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(creada, { status: 201 });
      }),
    );
    await e2e.post('/inscripciones', { cursoId: 'c', alumnoId: 'otro-alumno' });
    expect(body).toEqual({ alumnoId: ALUMNO });
  });

  it.each([
    ['sin cursoId', {}],
    ['cursoId vacío', { cursoId: '' }],
    ['cursoId numérico', { cursoId: 42 }],
  ])('400 SOLICITUD_INVALIDA %s, sin llamar al Módulo 9', async (_caso, body) => {
    const res = await e2e.post('/inscripciones', body);
    expect(res.status).toBe(400);
    expect(cuerpo(res)).toMatchObject({ code: 'SOLICITUD_INVALIDA' });
    expect(contrato.validar('post', '/inscripciones', 400, cuerpo(res)).errores).toEqual([]);
  });

  it('una comisión inexistente es 404 CURSO_NO_ENCONTRADO', async () => {
    e2e.server.use(
      http.post(RUTAS_ACADEMICO.INSCRIBIR, () =>
        HttpResponse.json({ code: 'NOT_FOUND' }, { status: 404 }),
      ),
    );
    const res = await e2e.post('/inscripciones', { cursoId: 'no-existe' });
    expect(res.status).toBe(404);
    expect(cuerpo(res)).toMatchObject({ code: 'CURSO_NO_ENCONTRADO' });
    expect(contrato.validar('post', '/inscripciones', 404, cuerpo(res)).errores).toEqual([]);
  });

  it.each([
    [503, 'UPSTREAM_UNAVAILABLE'],
    [502, 'UPSTREAM_INVALID'],
    [504, 'UPSTREAM_TIMEOUT'],
  ])('Gateway %i → %s y no se reintenta', async (status, code) => {
    let llamadas = 0;
    e2e.server.use(
      http.post(RUTAS_ACADEMICO.INSCRIBIR, () => {
        llamadas++;
        return new HttpResponse(null, { status });
      }),
    );
    const res = await e2e.post('/inscripciones', { cursoId: 'c' });
    expect(res.status).toBe(status);
    expect(cuerpo(res)).toMatchObject({ code, modulo: 'GESTION_ACADEMICA' });
    expect(contrato.validar('post', '/inscripciones', status, cuerpo(res)).errores).toEqual([]);
    expect(llamadas).toBe(1);
  });
});
