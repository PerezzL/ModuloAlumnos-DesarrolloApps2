import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from './app.js';
import { cargarConfig } from './config.js';

const DEMO = 'ba310c57-a684-4dbf-a4a4-905fcfbefa08';
const BO = '/backoffice/internal/v1';
const config = cargarConfig({ CORE_GATEWAY_TIMEOUT_MS: '200' });
const credenciales = config.clienteServicio;
let app: Awaited<ReturnType<typeof crearApp>>['app'];
let servicio: string;

beforeAll(async () => {
  ({ app } = await crearApp(config));
  servicio = (await request(app).post('/internal/v1/service-auth/token').send(credenciales)).body
    .accessToken as string;
});
beforeEach(async () => {
  await request(app).post('/__falso/reset').expect(204);
});

const get = (ruta: string, token = servicio) =>
  request(app).get(`${BO}${ruta}`).set('Authorization', `Bearer ${token}`);

describe('Token de servicio', () => {
  it('con las credenciales del portal emite un token de 900 s', async () => {
    const res = await request(app).post('/internal/v1/service-auth/token').send(credenciales);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ expiresIn: 900, tokenType: 'Bearer' });
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('con un secreto equivocado → 401', async () => {
    const res = await request(app)
      .post('/internal/v1/service-auth/token')
      .send({ ...credenciales, clientSecret: 'otro' });
    expect(res.status).toBe(401);
  });
});

describe('Lecturas internas de Backoffice', () => {
  it('ficha y sedes con token de servicio, con las mismas respuestas que por el Gateway', async () => {
    const ficha = await get(`/users/${DEMO}`);
    expect(ficha.status).toBe(200);
    expect(ficha.body).toMatchObject({ firstName: 'Valentina' });
    const sedes = await get('/sites?limit=2');
    expect(sedes.status).toBe(200);
    expect(sedes.body.items).toHaveLength(2);
    expect((await get('/users/no-existe')).status).toBe(404);
  });

  it('sin token → 401; con el token de un alumno → 403', async () => {
    expect((await request(app).get(`${BO}/sites`)).status).toBe(401);
    const alumno = (
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'v.moreno@uade.edu.ar', password: 'uade2026' })
    ).body.accessToken as string;
    expect((await get('/sites', alumno)).status).toBe(403);
  });

  it('respeta la falla simulada de backoffice', async () => {
    await request(app).put('/__falso/fallas/backoffice').send({ tipo: 'caido' }).expect(200);
    expect((await get('/sites')).status).toBe(503);
  });
});
