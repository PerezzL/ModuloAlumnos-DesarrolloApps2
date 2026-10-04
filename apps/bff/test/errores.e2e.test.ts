import 'reflect-metadata';
import { Controller, Get, type INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Contrato } from '@uadenet/contrato';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aplicarEnvDePrueba } from './env';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/app';
import { Publico } from '../src/auth/publico.decorator';
import { correlationIdActual } from '../src/comun/contexto';
import { ProblemaError } from '../src/comun/problema';

@Publico()
@Controller('prueba')
class PruebaController {
  @Get('explota')
  explota() {
    throw new Error('detalle interno que no debe filtrarse');
  }

  @Get('modulo-caido')
  moduloCaido() {
    throw new ProblemaError(503, 'UPSTREAM_UNAVAILABLE', 'Módulo no disponible', {
      modulo: 'GESTION_ACADEMICA',
    });
  }

  @Get('correlation')
  correlation() {
    return { correlationId: correlationIdActual() };
  }
}

@Module({ imports: [AppModule], controllers: [PruebaController] })
class AppDePrueba {}

const contrato = new Contrato();

describe('errores y correlation id', () => {
  let app: INestApplication;

  beforeAll(async () => {
    aplicarEnvDePrueba();
    const modulo = await Test.createTestingModule({ imports: [AppDePrueba] }).compile();
    app = configurarApp(modulo.createNestApplication({ bufferLogs: true }));
    await app.init();
  });

  afterAll(() => app.close());

  it('un error no controlado sale como problem+json 500, sin stack ni detalle interno', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/prueba/explota');
    expect(res.status).toBe(500);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    const body = JSON.parse(res.text);
    expect(body).toMatchObject({ status: 500, code: 'ERROR_INTERNO' });
    expect(res.text).not.toMatch(/detalle interno|at .*\.ts/);
  });

  it('una ruta inexistente sale como problem+json 404', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/no-existe');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(JSON.parse(res.text)).toMatchObject({ code: 'NO_ENCONTRADO' });
  });

  it('un ProblemaError respeta status, code y módulo, y cumple el contrato', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/prueba/modulo-caido')
      .set('X-Correlation-Id', 'abc-123');
    const body = JSON.parse(res.text);
    expect(res.status).toBe(503);
    expect(body).toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
      modulo: 'GESTION_ACADEMICA',
      correlationId: 'abc-123',
    });
    expect(contrato.validar('get', '/me', 503, body).errores).toEqual([]);
  });

  it('propaga el X-Correlation-Id recibido al contexto y a la respuesta', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/prueba/correlation')
      .set('X-Correlation-Id', 'desde-gateway');
    expect(res.headers['x-correlation-id']).toBe('desde-gateway');
    expect(res.body).toEqual({ correlationId: 'desde-gateway' });
  });

  it('genera un X-Correlation-Id si no viene', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/prueba/correlation');
    expect(res.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.correlationId).toBe(res.headers['x-correlation-id']);
  });
});
