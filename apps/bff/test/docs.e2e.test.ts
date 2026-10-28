import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aplicarEnvDePrueba } from './env';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/app';

describe('documentación del contrato', () => {
  let app: INestApplication;

  beforeAll(async () => {
    aplicarEnvDePrueba();
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configurarApp(modulo.createNestApplication({ bufferLogs: true }));
    await app.init();
  });

  afterAll(() => app.close());

  it.each(['/docs-json', '/api/v1/docs-json'])(
    '%s sirve openapi.yaml con los 10 endpoints',
    async (ruta) => {
      const res = await request(app.getHttpServer()).get(ruta);
      expect(res.status).toBe(200);
      const operaciones = Object.values(res.body.paths as Record<string, object>).flatMap(
        Object.keys,
      );
      expect(operaciones).toHaveLength(10);
    },
  );

  it.each(['/docs/', '/api/v1/docs/'])('%s sirve Swagger UI sin token', async (ruta) => {
    const res = await request(app.getHttpServer()).get(ruta);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/swagger-ui/i);
  });
});
