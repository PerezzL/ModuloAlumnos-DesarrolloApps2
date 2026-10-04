import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { ConfigCore } from './config.js';
import type { Notificaciones } from './notificaciones.js';
import type { Tokens } from './tokens.js';

/**
 * Tiempo real de la sección 8.3: namespace `/notifications`, autenticado con el access
 * token en el handshake. Cada socket entra a la room `user:{sub}` del token; cualquier
 * userId que mande el cliente se ignora.
 */
export function conectarSocket(
  servidor: HttpServer,
  config: ConfigCore,
  tokens: Tokens,
  notificaciones: Notificaciones,
) {
  const io = new Server(servidor, { cors: { origin: config.webOrigin, credentials: true } });
  const espacio = io.of('/notifications');

  espacio.use(async (socket, next) => {
    const token: unknown = socket.handshake.auth?.token;
    const claims = typeof token === 'string' ? await tokens.verificarAccess(token) : undefined;
    if (!claims) return next(new Error('AUTH_TOKEN_INVALID'));
    socket.data.userId = claims.sub;
    next();
  });
  espacio.on('connection', (socket) => {
    void socket.join(`user:${String(socket.data.userId)}`);
  });

  notificaciones.alCrear((userId, notificacion) => {
    espacio.to(`user:${userId}`).emit('notification.created', notificacion);
  });

  return io;
}
