import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configurarApp } from './app';
import { CONFIG, ConfigInvalidaError, cargarConfig, type Config } from './config/config';

async function bootstrap() {
  // En desarrollo, las variables salen del .env de la raíz del monorepo
  const env = resolve(__dirname, '../../../.env');
  if (existsSync(env)) process.loadEnvFile(env);
  // Validar antes de crear la app, para que el error sea solo la lista de variables
  cargarConfig();

  const app = configurarApp(await NestFactory.create(AppModule, { bufferLogs: true }));
  const config = app.get<Config>(CONFIG);
  await app.listen(config.BFF_PORT);
}

bootstrap().catch((error: unknown) => {
  if (error instanceof ConfigInvalidaError) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
