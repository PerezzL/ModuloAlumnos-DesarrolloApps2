import { Contrato } from '@uadenet/contrato';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { RUTAS_ACADEMICO } from './academico-gateway';
import { ALUMNO, cuerpo, GW, prepararE2E } from './app-e2e';
import { fixture } from './fixtures';

const contrato = new Contrato();
const USUARIO = `${GW}/api/v1/backoffice/users/${ALUMNO}`;
const datos = Object.values(
  fixture<Record<string, Record<string, unknown>>>('backoffice/users.provisional.json'),
)[0]!;
const carreras = () =>
  http.get(RUTAS_ACADEMICO.CARRERAS, () =>
    HttpResponse.json(fixture('academic/carreras.provisional.json')),
  );

describe('GET /me', () => {
  const e2e = prepararE2E();

  it('combina token, Backoffice y la carrera del Módulo 9, y cumple el contrato', async () => {
    let autorizacion: string | null = null;
    e2e.server.use(
      http.get(USUARIO, ({ request }) => {
        autorizacion = request.headers.get('authorization');
        return HttpResponse.json(datos);
      }),
      carreras(),
    );
    const res = await e2e.get('/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: ALUMNO,
      email: 'v.moreno@uade.edu.ar',
      nombre: 'Valentina',
      apellido: 'Moreno',
      legajo: '1123456',
      carrera: 'Ingeniería en Informática',
      planId: '12',
    });
    expect(contrato.validar('get', '/me', 200, res.body).errores).toEqual([]);
    expect(autorizacion).toBe(`Bearer ${e2e.token}`);
  });

  it('sin carreras no consulta al Módulo 9', async () => {
    let consultado = false;
    e2e.server.use(
      http.get(USUARIO, () => HttpResponse.json({ ...datos, careers: [] })),
      http.get(RUTAS_ACADEMICO.CARRERAS, () => {
        consultado = true;
        return HttpResponse.json([]);
      }),
    );
    const res = await e2e.get('/me');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ planId: null });
    expect(consultado).toBe(false);
  });

  it('si Backoffice no conoce al alumno, devuelve solo la identidad', async () => {
    e2e.server.use(http.get(USUARIO, () => HttpResponse.json({}, { status: 404 })));
    const res = await e2e.get('/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: ALUMNO, email: 'v.moreno@uade.edu.ar' });
  });

  it.each([
    [503, 'UPSTREAM_UNAVAILABLE'],
    [502, 'UPSTREAM_INVALID'],
    [504, 'UPSTREAM_TIMEOUT'],
  ])('Gateway %i → %s de BACKOFFICE, según el contrato', async (status, code) => {
    e2e.server.use(http.get(USUARIO, () => new HttpResponse(null, { status })));
    const res = await e2e.get('/me');
    expect(res.status).toBe(status);
    expect(cuerpo(res)).toMatchObject({ code, modulo: 'BACKOFFICE' });
    expect(contrato.validar('get', '/me', status, cuerpo(res)).errores).toEqual([]);
  });

  it('una respuesta con forma inesperada es 502', async () => {
    e2e.server.use(http.get(USUARIO, () => HttpResponse.json(['no', 'es', 'un', 'usuario'])));
    const res = await e2e.get('/me');
    expect(res.status).toBe(502);
    expect(cuerpo(res)).toMatchObject({ code: 'UPSTREAM_INVALID', modulo: 'BACKOFFICE' });
  });
});

// App propia: el catálogo de carreras queda en caché entre requests de la misma app
describe('GET /me · nombre de la carrera', () => {
  const e2e = prepararE2E();

  it.each([
    [
      'el Módulo 9 está caído',
      http.get(RUTAS_ACADEMICO.CARRERAS, () => new HttpResponse(null, { status: 503 })),
    ],
    [
      'el Módulo 9 no conoce la carrera',
      http.get(RUTAS_ACADEMICO.CARRERAS, () => HttpResponse.json([])),
    ],
  ])('si %s, el perfil sale sin carrera', async (_caso, respuesta) => {
    e2e.server.use(
      http.get(USUARIO, () => HttpResponse.json(datos)),
      respuesta,
    );
    const res = await e2e.get('/me');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ nombre: 'Valentina', planId: '12' });
    expect(res.body).not.toHaveProperty('carrera');
    expect(contrato.validar('get', '/me', 200, res.body).errores).toEqual([]);
  });
});

// Token de CORE con `careerIds`: la carrera sale de ahí y Backoffice queda de respaldo
describe('GET /me · carrera del token', () => {
  const e2e = prepararE2E({ claims: { careerIds: [3] } });

  it('usa la carrera del token aunque Backoffice informe otra primero', async () => {
    e2e.server.use(
      http.get(USUARIO, () =>
        HttpResponse.json({
          ...datos,
          careers: [
            { careerId: '99', planId: '50' },
            { careerId: '3', planId: '12' },
          ],
        }),
      ),
      carreras(),
    );
    const res = await e2e.get('/me');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ carrera: 'Ingeniería en Informática', planId: '12' });
    expect(contrato.validar('get', '/me', 200, res.body).errores).toEqual([]);
  });

  it('si Backoffice no conoce al alumno, la carrera sale igual del token', async () => {
    e2e.server.use(
      http.get(USUARIO, () => HttpResponse.json({}, { status: 404 })),
      carreras(),
    );
    const res = await e2e.get('/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: ALUMNO,
      email: 'v.moreno@uade.edu.ar',
      carrera: 'Ingeniería en Informática',
    });
  });
});

describe('GET /me · caché de carreras', () => {
  const e2e = prepararE2E();

  it('el catálogo de carreras se pide una vez entre requests', async () => {
    let consultas = 0;
    e2e.server.use(
      http.get(USUARIO, () => HttpResponse.json(datos)),
      http.get(RUTAS_ACADEMICO.CARRERAS, () => {
        consultas++;
        return HttpResponse.json(fixture('academic/carreras.provisional.json'));
      }),
    );
    await e2e.get('/me');
    const res = await e2e.get('/me');
    expect(res.body).toMatchObject({ carrera: 'Ingeniería en Informática' });
    expect(consultas).toBe(1);
  });
});
