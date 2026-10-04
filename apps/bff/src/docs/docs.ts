import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import type { Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';

/** openapi.yaml de la raíz del monorepo. En la imagen de Docker se indica con OPENAPI_PATH. */
const rutaContrato = () =>
  process.env.OPENAPI_PATH ?? resolve(__dirname, '../../../../openapi.yaml');

/**
 * Publica el contrato: Swagger UI en /docs y el JSON en /docs-json (convención de CORE),
 * en la raíz y bajo /api/v1 (lo que llega por el Gateway). La fuente es openapi.yaml;
 * no se usan los decoradores de @nestjs/swagger.
 */
export function publicarDocs(app: INestApplication) {
  const documento = parse(readFileSync(rutaContrato(), 'utf8')) as Record<string, unknown>;
  const json = (_req: Request, res: Response) => res.json(documento);
  for (const base of ['', '/api/v1']) {
    app.use(`${base}/docs-json`, json);
    app.use(`${base}/docs`, swaggerUi.serveFiles(documento), swaggerUi.setup(documento));
  }
}
