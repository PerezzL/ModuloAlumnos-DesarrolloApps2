import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
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
import { firmar } from '../src/auth/firma';

export const GW = envDePrueba.GATEWAY_URL;
/** Lecturas internas de Backoffice: se llaman directo, con el token de servicio */
export const BO = envDePrueba.BACKOFFICE_INTERNAL_URL;
/** Token de servicio que emite el CORE simulado en todos los e2e */
export const TOKEN_SERVICIO = 'token-de-servicio-e2e';
export const ALUMNO = 'alumno-opaco-1';

/**
 * Headers que agrega el Gateway de CORE, con la firma `X-Core-Signature` calculada con el
 * secreto de prueba. `ruta` es la que recibe el BFF (`/api/v1/...`).
 */
export function headersFirmados(
  metodo: string,
  ruta: string,
  opciones: { userId?: string; timestamp?: number } = {},
): Record<string, string> {
  const pedido = {
    metodo,
    ruta,
    userId: opciones.userId ?? ALUMNO,
    correlationId: randomUUID(),
    timestamp: String(opciones.timestamp ?? Date.now()),
  };
  return {
    'X-User-Id': pedido.userId,
    'X-Correlation-Id': pedido.correlationId,
    'X-Core-Timestamp': pedido.timestamp,
    'X-Core-Signature': firmar(envDePrueba.CORE_SIGNATURE_SECRET, pedido),
  };
}

/**
 * BFF completo para tests e2e: JWKS de prueba y Gateway simulado con msw. Cada test agrega
 * los handlers de los módulos que necesita con `server.use(...)`; un pedido sin handler falla.
 */
export function prepararE2E(opciones: { claims?: Record<string, unknown> } = {}) {
  let jwks: { keys: object[] } = { keys: [] };
  const server = setupServer(
    http.get(envDePrueba.JWKS_URL, () => HttpResponse.json(jwks)),
    http.post(envDePrueba.SERVICE_TOKEN_URL, () =>
      HttpResponse.json({ accessToken: TOKEN_SERVICIO, expiresIn: 900, tokenType: 'Bearer' }),
    ),
  );
  const ctx = {
    server,
    app: undefined as unknown as INestApplication,
    token: '',
    /** GET autenticado como ALUMNO, firmado como lo hace el Gateway */
    get(ruta: string) {
      return request(ctx.app.getHttpServer())
        .get(`/api/v1${ruta}`)
        .set(headersFirmados('GET', `/api/v1${ruta}`))
        .set('Authorization', `Bearer ${ctx.token}`);
    },
    /** POST JSON autenticado como ALUMNO, firmado como lo hace el Gateway */
    post(ruta: string, body: string | object) {
      return request(ctx.app.getHttpServer())
        .post(`/api/v1${ruta}`)
        .set(headersFirmados('POST', `/api/v1${ruta}`))
        .set('Authorization', `Bearer ${ctx.token}`)
        .set('Content-Type', 'application/json')
        .send(body);
    },
  };

  beforeAll(async () => {
    aplicarEnvDePrueba();
    const emisor = await EmisorDePrueba.crear();
    ctx.token = await emisor.firmar({ sub: ALUMNO, claims: opciones.claims });
    jwks = { keys: [emisor.jwk] };
    // supertest le habla al BFF por localhost: eso pasa; un módulo sin handler, falla
    server.listen({
      onUnhandledRequest: (req, print) => {
        if ([GW, new URL(BO).origin].includes(new URL(req.url).origin)) print.error();
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
