import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { CONFIG, type Config } from '../config/config';
import { HEADER_CORRELATION } from './contexto';

/** Logs JSON con pino. Cada línea de un request lleva su correlationId. */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [CONFIG],
      useFactory: (config: Config) => ({
        pinoHttp: {
          level: config.LOG_LEVEL,
          // El correlation id ya lo resolvió correlationMiddleware
          genReqId: (req) => String(req.headers[HEADER_CORRELATION]),
          customAttributeKeys: { reqId: 'correlationId' },
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          autoLogging: { ignore: (req) => req.url?.includes('/health/') ?? false },
          transport:
            process.env.NODE_ENV === 'production'
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true } },
        },
      }),
    }),
  ],
})
export class LoggerModule {}
