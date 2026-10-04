import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { routerAuth } from './auth.js';
import type { ConfigCore } from './config.js';
import { gateway } from './gateway.js';
import { enviarProblema } from './problema.js';
import { Tokens } from './tokens.js';

export interface OpcionesApp {
  /** Permite a los tests cambiar el destino del Gateway sin reiniciar */
  studentServiceUrl?: () => string;
}

export async function crearApp(config: ConfigCore, opciones: OpcionesApp = {}) {
  const tokens = await Tokens.crear(config);
  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.setHeader('X-Correlation-Id', req.header('x-correlation-id') ?? randomUUID());
    next();
  });
  app.use(
    cors({
      origin: config.webOrigin,
      credentials: true,
      exposedHeaders: ['X-Correlation-Id', 'Retry-After'],
    }),
  );
  app.use(cookieParser());
  app.use(express.json());

  app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
  app.get('/.well-known/jwks.json', (_req, res) => res.json(tokens.jwks()));
  app.use('/api/v1/auth', routerAuth(config, tokens));
  app.use(
    '/api/v1/student',
    gateway(config, tokens, opciones.studentServiceUrl ?? (() => config.studentServiceUrl)),
  );

  app.use((_req: express.Request, res: express.Response) =>
    enviarProblema(res, 404, 'NOT_FOUND', 'No existe en el CORE falso'),
  );

  return { app, tokens };
}
