import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aplicarEnvDePrueba } from './env';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/app';

describe('health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    aplicarEnvDePrueba();
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configurarApp(modulo.createNestApplication({ bufferLogs: true }));
    await app.init();
  });

  afterAll(() => app.close());

  it.each(['/health/live', '/health/ready', '/api/v1/health/live', '/api/v1/health/ready'])(
    'GET %s responde ok',
    async (ruta) => {
      const res = await request(app.getHttpServer()).get(ruta);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    },
  );
});
