import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from './app.js';
import { cargarConfig } from './config.js';

const config = cargarConfig({ JWT_ISSUER: 'http://core.test', JWT_AUDIENCE: 'uadenet' });
let app: Awaited<ReturnType<typeof crearApp>>['app'];
let server: Server;

const login = (email = 'v.moreno@uade.edu.ar', password = 'uade2026') =>
  request(app).post('/api/v1/auth/login').send({ email, password });

const cookieRefresh = (res: request.Response) =>
  ([] as string[])
    .concat(res.headers['set-cookie'] ?? [])
    .find((c) => c.startsWith('refresh_token='))!;

beforeAll(async () => {
  ({ app } = await crearApp(config));
  server = app.listen(0);
});
afterAll(() => server.close());

describe('auth del CORE falso', () => {
  it('login devuelve un access token que se valida contra el JWKS', async () => {
    const res = await login();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ expiresIn: 900, user: { email: 'v.moreno@uade.edu.ar' } });
    expect(cookieRefresh(res)).toMatch(/HttpOnly/);
    expect(cookieRefresh(res)).toMatch(/SameSite=Lax/);

    const { port } = server.address() as AddressInfo;
    const jwks = createRemoteJWKSet(new URL(`http://localhost:${port}/.well-known/jwks.json`));
    const { payload, protectedHeader } = await jwtVerify(res.body.accessToken, jwks, {
      issuer: 'http://core.test',
      audience: 'uadenet',
    });
    expect(protectedHeader.alg).toBe('RS256');
    expect(payload).toMatchObject({ sub: res.body.user.id, roles: ['STUDENT'] });
    expect(payload).toHaveProperty('sid');
    expect(payload).toHaveProperty('jti');
  });

  it('credenciales inválidas → 401 AUTH_INVALID_CREDENTIALS, sin decir cuál falló', async () => {
    const res = await login('v.moreno@uade.edu.ar', 'otra');
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toMatch(/problem\+json/);
    expect(JSON.parse(res.text).code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('cuenta suspendida → 403 AUTH_IDENTITY_SUSPENDED', async () => {
    const res = await login('suspendido@uade.edu.ar');
    expect(res.status).toBe(403);
    expect(JSON.parse(res.text).code).toBe('AUTH_IDENTITY_SUSPENDED');
  });

  it('demasiados intentos → 429 RATE_LIMITED', async () => {
    for (let i = 0; i < 5; i++) await login('j.perez@uade.edu.ar', 'mal');
    const res = await login('j.perez@uade.edu.ar', 'uade2026');
    expect(res.status).toBe(429);
    expect(JSON.parse(res.text).code).toBe('RATE_LIMITED');
  });

  it('el refresh rota: el token anterior deja de valer', async () => {
    const original = cookieRefresh(await login());
    const primero = await request(app).post('/api/v1/auth/refresh').set('Cookie', original);
    expect(primero.status).toBe(200);
    expect(primero.body.accessToken).toBeTruthy();
    expect(cookieRefresh(primero)).not.toBe(original);

    const repetido = await request(app).post('/api/v1/auth/refresh').set('Cookie', original);
    expect(repetido.status).toBe(401);
  });

  it('me devuelve los datos de autorización del token', async () => {
    const { body } = await login();
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(body.user);
  });

  it('logout invalida el refresh de la sesión', async () => {
    const res = await login();
    const cookie = cookieRefresh(res);
    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(logout.status).toBe(204);
    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refresh.status).toBe(401);
  });
});
