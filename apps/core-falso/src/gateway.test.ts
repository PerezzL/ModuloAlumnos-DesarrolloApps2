import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from './app.js';
import { cargarConfig } from './config.js';

let destino = 'http://localhost:1';
let recibido: IncomingMessage | undefined;
let demora = 0;
const servicio: Server = createServer((req, res) => {
  recibido = req;
  setTimeout(() => {
    res.writeHead(418, { 'content-type': 'application/json', 'x-propio': 'si' });
    res.end(JSON.stringify({ url: req.url }));
  }, demora);
});

const config = cargarConfig({ CORE_GATEWAY_TIMEOUT_MS: '200' });
let app: Awaited<ReturnType<typeof crearApp>>['app'];
let token: string;

beforeAll(async () => {
  ({ app } = await crearApp(config, { studentServiceUrl: () => destino }));
  await new Promise<void>((ok) => servicio.listen(0, ok));
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'v.moreno@uade.edu.ar', password: 'uade2026' });
  token = login.body.accessToken;
});
beforeEach(() => {
  destino = `http://localhost:${(servicio.address() as AddressInfo).port}`;
  recibido = undefined;
  demora = 0;
});
afterAll(() => servicio.close());

describe('Gateway del CORE falso', () => {
  it('reescribe /api/v1/student/* a /api/v1/* e inyecta la identidad', async () => {
    const res = await request(app)
      .get('/api/v1/student/calendario?desde=2026-10-01')
      .set('Authorization', `Bearer ${token}`)
      .set('X-User-Id', 'falsificado')
      .set('X-Correlation-Id', 'corr-9');

    expect(res.status).toBe(418);
    expect(res.body).toEqual({ url: '/api/v1/calendario?desde=2026-10-01' });
    expect(res.headers['x-propio']).toBe('si');
    expect(recibido?.headers['x-user-id']).toBe('ba310c57-a684-4dbf-a4a4-905fcfbefa08');
    expect(recibido?.headers['x-user-roles']).toBe('STUDENT');
    expect(recibido?.headers['x-user-permissions']).toContain('wallet:read:self');
    expect(recibido?.headers['x-correlation-id']).toBe('corr-9');
    expect(recibido?.headers.authorization).toBe(`Bearer ${token}`);
  });

  it('deja pasar health sin token y sin X-User-*', async () => {
    const res = await request(app).get('/api/v1/student/health/live').set('X-User-Id', 'x');
    expect(res.status).toBe(418);
    expect(recibido?.headers['x-user-id']).toBeUndefined();
  });

  it('sin token válido en una ruta protegida → 401 sin llegar al servicio', async () => {
    const res = await request(app).get('/api/v1/student/me').set('Authorization', 'Bearer x');
    expect(res.status).toBe(401);
    expect(recibido).toBeUndefined();
  });

  it('servicio caído → 503 UPSTREAM_UNAVAILABLE', async () => {
    destino = 'http://localhost:1';
    const res = await request(app)
      .get('/api/v1/student/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(503);
    expect(JSON.parse(res.text).code).toBe('UPSTREAM_UNAVAILABLE');
  });

  it('servicio lento → 504 UPSTREAM_TIMEOUT', async () => {
    demora = 400;
    const res = await request(app)
      .get('/api/v1/student/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(504);
    expect(JSON.parse(res.text).code).toBe('UPSTREAM_TIMEOUT');
  });
});
