import 'reflect-metadata';
import { Controller, Get, type INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { aplicarEnvDePrueba, envDePrueba } from './env';
import { EmisorDePrueba } from './tokens';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/app';
import { type Alumno, AlumnoActual } from '../src/auth/alumno.decorator';

@Controller('protegido')
class ProtegidoController {
  @Get()
  quienSoy(@AlumnoActual() alumno: Alumno) {
    return alumno;
  }
}

@Module({ imports: [AppModule], controllers: [ProtegidoController] })
class AppDePrueba {}

let emisor: EmisorDePrueba;
let otraClave: EmisorDePrueba;
let jwks: { keys: unknown[] };
let pedidosJwks = 0;
const server = setupServer(
  http.get(envDePrueba.JWKS_URL, () => {
    pedidosJwks++;
    return HttpResponse.json(jwks);
  }),
);

describe('guard de JWT', () => {
  let app: INestApplication;
  const pedir = (token?: string, headers: Record<string, string> = {}) => {
    const req = request(app.getHttpServer()).get('/api/v1/protegido').set(headers);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };
  const esNoAutenticado = (res: request.Response) => {
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toMatch(/problem\+json/);
    expect(JSON.parse(res.text).code).toBe('AUTH_TOKEN_INVALID');
  };

  beforeAll(async () => {
    aplicarEnvDePrueba();
    emisor = await EmisorDePrueba.crear('clave-1');
    otraClave = await EmisorDePrueba.crear('clave-1');
    jwks = { keys: [emisor.jwk] };
    server.listen({ onUnhandledRequest: 'bypass' });
    const modulo = await Test.createTestingModule({ imports: [AppDePrueba] }).compile();
    app = configurarApp(modulo.createNestApplication({ bufferLogs: true }));
    await app.init();
  });
  beforeEach(() => {
    jwks = { keys: [emisor.jwk] };
  });
  afterAll(async () => {
    await app.close();
    server.close();
  });

  it('con un token válido deja pasar y expone el id del token, sin parsearlo', async () => {
    const res = await pedir(await emisor.firmar());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'alumno-opaco-1', email: 'v.moreno@uade.edu.ar' });
  });

  it('sin token → 401', async () => esNoAutenticado(await pedir()));

  it('token vencido → 401', async () =>
    esNoAutenticado(await pedir(await emisor.firmar({ exp: Math.floor(Date.now() / 1000) - 60 }))));

  it('firma inválida → 401', async () => esNoAutenticado(await pedir(await otraClave.firmar())));

  it('issuer incorrecto → 401', async () =>
    esNoAutenticado(await pedir(await emisor.firmar({ iss: 'http://otro' }))));

  it('audience incorrecta → 401', async () =>
    esNoAutenticado(await pedir(await emisor.firmar({ aud: 'otra' }))));

  it('token sin sub → 401', async () =>
    esNoAutenticado(await pedir(await emisor.firmar({ sub: '' }))));

  it('X-User-Id distinto del token → 401', async () =>
    esNoAutenticado(await pedir(await emisor.firmar(), { 'X-User-Id': 'otro-alumno' })));

  it('health sigue siendo público', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/live');
    expect(res.status).toBe(200);
  });

  it('cachea las claves y solo vuelve a pedir el JWKS ante un kid desconocido', async () => {
    const nueva = await EmisorDePrueba.crear('clave-2');
    await pedir(await emisor.firmar());
    const antes = pedidosJwks;

    await pedir(await emisor.firmar());
    await pedir(await emisor.firmar());
    expect(pedidosJwks).toBe(antes);

    // Pasado el cooldown anti-abuso de 30 s, un kid desconocido dispara un nuevo pedido
    jwks = { keys: [emisor.jwk, nueva.jwk] };
    const token = await nueva.firmar();
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 31_000 });
    try {
      const res = await pedir(token);
      expect(res.status).toBe(200);
      expect(pedidosJwks).toBe(antes + 1);
    } finally {
      vi.useRealTimers();
    }
  });
});
