import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import type { Server as HttpServer } from 'node:http';
import express, { type RequestHandler } from 'express';
import { routerAuth } from './auth.js';
import { MODULOS, type ConfigCore, type Modulo } from './config.js';
import { Fallas } from './fallas.js';
import { routerFalso } from './falso.js';
import { gateway } from './gateway.js';
import { EstadoAcademico, moduloAcademico } from './modulos/academico.js';
import { moduloBackoffice } from './modulos/backoffice.js';
import { moduloComedor } from './modulos/comedor.js';
import { moduloDocente } from './modulos/docente.js';
import { moduloEventos } from './modulos/eventos.js';
import { moduloTienda } from './modulos/tienda.js';
import { Notificaciones, routerNotificaciones } from './notificaciones.js';
import { enviarProblema } from './problema.js';
import { routerSaldo, Saldos } from './saldo.js';
import { conectarSocket } from './socket.js';
import { Tokens } from './tokens.js';

export interface OpcionesApp {
  /** Permite a los tests cambiar el destino del Gateway sin reiniciar */
  studentServiceUrl?: () => string;
}

export async function crearApp(config: ConfigCore, opciones: OpcionesApp = {}) {
  const tokens = await Tokens.crear(config);
  const fallas = new Fallas(config.fallas);
  const academico = new EstadoAcademico();
  const notificaciones = new Notificaciones();
  const saldos = new Saldos();
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
  // El portal usa notificaciones y saldo directo de CORE, sin pasar por el BFF
  app.use('/api/v1/notifications', routerNotificaciones(tokens, notificaciones));
  app.use('/api/v1/wallets', routerSaldo(tokens, saldos));

  // Módulos externos de mentira: responden si no hay un {MODULO}_SERVICE_URL configurado
  const locales: Record<Exclude<Modulo, 'student'>, RequestHandler> = {
    teacher: moduloDocente(),
    dining: moduloComedor(),
    store: moduloTienda(),
    events: moduloEventos(),
    backoffice: moduloBackoffice(),
    academic: moduloAcademico(academico),
  };
  app.use(
    MODULOS.student,
    gateway(config, tokens, {
      modulo: 'student',
      destino: opciones.studentServiceUrl ?? (() => config.studentServiceUrl),
      fallas,
    }),
  );
  for (const [modulo, local] of Object.entries(locales) as [
    keyof typeof locales,
    RequestHandler,
  ][]) {
    app.use(
      MODULOS[modulo],
      gateway(config, tokens, { modulo, destino: () => config.servicios[modulo], local, fallas }),
    );
  }

  app.use(
    '/__falso',
    routerFalso({
      fallas,
      notificaciones,
      academico,
      reinicios: [academico, notificaciones, saldos].map((estado) => () => estado.reiniciar()),
    }),
  );

  app.use((_req: express.Request, res: express.Response) =>
    enviarProblema(res, 404, 'NOT_FOUND', 'No existe en el CORE falso'),
  );

  return {
    app,
    tokens,
    /** socket.io necesita el servidor HTTP, que existe recién al escuchar */
    conectarSocket: (servidor: HttpServer) =>
      conectarSocket(servidor, config, tokens, notificaciones),
  };
}
