import { Contrato } from '@uadenet/contrato';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ALUMNO, cuerpo, GW, prepararE2E } from './app-e2e';
import { fixture } from './fixtures';

const contrato = new Contrato();
const USUARIO = `${GW}/api/v1/backoffice/users/${ALUMNO}`;
const datos = Object.values(
  fixture<Record<string, Record<string, unknown>>>('backoffice/users.provisional.json'),
)[0];

describe('GET /me', () => {
  const e2e = prepararE2E();

  it('combina token y Backoffice, y cumple el contrato', async () => {
    let autorizacion: string | null = null;
    e2e.server.use(
      http.get(USUARIO, ({ request }) => {
        autorizacion = request.headers.get('authorization');
        return HttpResponse.json(datos);
      }),
    );
    const res = await e2e.get('/me');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: ALUMNO,
      email: 'v.moreno@uade.edu.ar',
      nombre: 'Valentina',
    });
    expect(contrato.validar('get', '/me', 200, res.body).errores).toEqual([]);
    expect(autorizacion).toBe(`Bearer ${e2e.token}`);
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
