import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import request from 'supertest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { aplicarEnvDePrueba, envDePrueba } from './env';
import { EmisorDePrueba } from './tokens';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/app';

export const GW = envDePrueba.GATEWAY_URL;
export const ALUMNO = 'alumno-opaco-1';

/**
 * BFF completo para tests e2e: JWKS de prueba y Gateway simulado con msw. Cada test agrega
 * los handlers de los módulos que necesita con `server.use(...)`; un pedido sin handler falla.
 */
export function prepararE2E() {
  let jwks: { keys: object[] } = { keys: [] };
  const server = setupServer(http.get(envDePrueba.JWKS_URL, () => HttpResponse.json(jwks)));
  const ctx = {
    server,
    app: undefined as unknown as INestApplication,
    token: '',
    /** GET autenticado como ALUMNO */
    get(ruta: string) {
      return request(ctx.app.getHttpServer())
        .get(`/api/v1${ruta}`)
        .set('Authorization', `Bearer ${ctx.token}`);
    },
  };

  beforeAll(async () => {
    aplicarEnvDePrueba();
    const emisor = await EmisorDePrueba.crear();
    ctx.token = await emisor.firmar({ sub: ALUMNO });
    jwks = { keys: [emisor.jwk] };
    // supertest le habla al BFF por localhost: eso pasa; un módulo sin handler, falla
    server.listen({
      onUnhandledRequest: (req, print) => {
        if (new URL(req.url).origin === GW) print.error();
      },
    });
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    ctx.app = configurarApp(modulo.createNestApplication({ bufferLogs: true }));
    await ctx.app.init();
  });
  afterEach(() => server.resetHandlers());
  afterAll(async () => {
    await ctx.app.close();
    server.close();
  });

  return ctx;
}

/** Cuerpo JSON de una respuesta (problem+json incluido) */
export const cuerpo = (res: request.Response): unknown => JSON.parse(res.text);
