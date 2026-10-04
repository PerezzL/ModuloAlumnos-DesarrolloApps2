import type { INestApplication } from '@nestjs/common';
import { estadoHealth } from './health/health.controller';

export const PREFIJO_API = 'api/v1';

/** Configuración común a main.ts y a los tests e2e. */
export function configurarApp(app: INestApplication) {
  // Health también en la raíz, sin prefijo
  app.use('/health/live', (_req: unknown, res: { json: (b: unknown) => void }) =>
    res.json(estadoHealth()),
  );
  app.use('/health/ready', (_req: unknown, res: { json: (b: unknown) => void }) =>
    res.json(estadoHealth()),
  );
  app.setGlobalPrefix(PREFIJO_API);
  return app;
}
