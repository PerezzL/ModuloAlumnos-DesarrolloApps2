import type { INestApplication } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';
import { correlationMiddleware } from './comun/contexto';
import { publicarDocs } from './docs/docs';
import { estadoHealth } from './health/health.controller';

export const PREFIJO_API = 'api/v1';

/** Configuración común a main.ts y a los tests e2e. */
export function configurarApp(app: INestApplication) {
  app.useLogger(app.get(Logger));
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use(correlationMiddleware);
  // Health también en la raíz, sin prefijo
  app.use('/health/live', (_req: Request, res: Response) => res.json(estadoHealth()));
  app.use('/health/ready', (_req: Request, res: Response) => res.json(estadoHealth()));
  publicarDocs(app);
  app.setGlobalPrefix(PREFIJO_API);
  return app;
}
