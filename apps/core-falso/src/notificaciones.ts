import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { requiereUsuario } from './auth.js';
import { fixture } from './fixtures.js';
import { ALUMNO_DEMO } from './modulos/comun.js';
import { paginar, QueryInvalida } from './paginacion.js';
import { enviarProblema } from './problema.js';
import type { Tokens } from './tokens.js';

export const TIPOS_NOTIFICACION = [
  'TEACHER_EXAM_RESULT_PUBLISHED',
  'LIBRARY_PENALTY_APPLIED',
  'EVENT_REMINDER',
] as const;
export type TipoNotificacion = (typeof TIPOS_NOTIFICACION)[number];

/** Ítem de GET /api/v1/notifications, como en el OpenAPI de CORE (el actionUrl es supuesto) */
export interface Notificacion {
  id: string;
  userId: string;
  type: TipoNotificacion;
  title: string;
  message: string;
  actionUrl: string | null;
  sourceModule: string;
  sourceReference: string;
  readAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

type DatosNotificacion = Omit<Notificacion, 'id' | 'userId' | 'readAt' | 'createdAt'>;

type AlCrear = (userId: string, notificacion: Notificacion) => void;

/**
 * Notificaciones en memoria, por usuario. Como en CORE, se guardan antes de emitirse:
 * quien escucha (el socket) se entera después de que ya están en el listado.
 */
export class Notificaciones {
  private porUsuario = new Map<string, Notificacion[]>();
  private readonly oyentes: AlCrear[] = [];

  constructor() {
    this.reiniciar();
  }

  reiniciar() {
    this.porUsuario = new Map([
      [ALUMNO_DEMO, fixture<Notificacion[]>('core/notificaciones.provisional.json')],
    ]);
  }

  /** Más nuevas primero */
  de(userId: string) {
    return [...(this.porUsuario.get(userId) ?? [])].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  alCrear(oyente: AlCrear) {
    this.oyentes.push(oyente);
  }

  crear(userId: string, datos: DatosNotificacion) {
    const notificacion: Notificacion = {
      id: randomUUID(),
      userId,
      readAt: null,
      createdAt: new Date().toISOString(),
      ...datos,
    };
    this.porUsuario.set(userId, [...(this.porUsuario.get(userId) ?? []), notificacion]);
    for (const oyente of this.oyentes) oyente(userId, notificacion);
    return notificacion;
  }
}

/** Ejemplo de cada tipo, como lo derivaría CORE del evento del módulo de origen */
export function ejemplo(tipo: TipoNotificacion) {
  const ref = randomUUID();
  const ejemplos: Record<TipoNotificacion, DatosNotificacion> = {
    TEACHER_EXAM_RESULT_PUBLISHED: {
      type: tipo,
      title: 'Se publicó tu nota de Desarrollo de Aplicaciones I',
      message: 'Recuperatorio Parcial 1: 8 (aprobado)',
      // actionUrl provisorio del Módulo 2: nos pidieron la ruta y la ajustan
      actionUrl: '/student/courses/1006/exams/202',
      sourceModule: 'teacher',
      sourceReference: `exam-result/${ref}`,
      expiresAt: null,
    },
    LIBRARY_PENALTY_APPLIED: {
      type: tipo,
      title: 'Tenés una sanción de biblioteca',
      message: 'Devolviste un libro con 3 días de atraso. Multa: $ 1500,00',
      actionUrl: `/prestamos/${ref}`,
      sourceModule: 'library',
      sourceReference: `penalty/${ref}`,
      expiresAt: null,
    },
    EVENT_REMINDER: {
      type: tipo,
      title: 'Tu evento comienza en una semana',
      message: 'Torneo interfacultades de ajedrez — 7 de noviembre, 10:00',
      actionUrl: '/events/0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
      sourceModule: 'events',
      sourceReference: `event/0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d/reminder/${ref}`,
      expiresAt: '2026-11-07T13:00:00.000Z',
    },
  };
  return ejemplos[tipo];
}

export const esTipoNotificacion = (t: unknown): t is TipoNotificacion =>
  (TIPOS_NOTIFICACION as readonly unknown[]).includes(t);

/** REST de la sección 8.2 de CORE_INTEGRACION.md */
export function routerNotificaciones(tokens: Tokens, notificaciones: Notificaciones) {
  const router = Router();
  router.use(requiereUsuario(tokens));

  router.get('/', (req, res) => {
    const { read, type, cursor, limit } = req.query;
    if (read !== undefined && read !== 'true' && read !== 'false') {
      return enviarProblema(res, 400, 'VALIDATION_ERROR', 'read debe ser true o false');
    }
    const filtradas = notificaciones
      .de(res.locals.usuarioId)
      .filter((n) => read === undefined || String(n.readAt !== null) === read)
      .filter((n) => type === undefined || n.type === type);
    try {
      res.json(paginar(filtradas, cursor, limit));
    } catch (error) {
      if (!(error instanceof QueryInvalida)) throw error;
      enviarProblema(res, 400, 'VALIDATION_ERROR', error.message);
    }
  });

  router.get('/unread-count', (_req, res) => {
    res.json({
      count: notificaciones.de(res.locals.usuarioId).filter((n) => n.readAt === null).length,
    });
  });

  router.post('/read-all', (_req, res) => {
    const ahora = new Date().toISOString();
    for (const n of notificaciones.de(res.locals.usuarioId)) n.readAt ??= ahora;
    res.status(204).end();
  });

  router.patch('/:id', (req, res) => {
    const { read } = (req.body ?? {}) as { read?: unknown };
    if (typeof read !== 'boolean') {
      return enviarProblema(res, 400, 'VALIDATION_ERROR', 'read debe ser booleano');
    }
    // Las de otro usuario no existen para este
    const notificacion = notificaciones
      .de(res.locals.usuarioId)
      .find((n) => n.id === req.params.id);
    if (!notificacion) {
      return enviarProblema(res, 404, 'NOTIFICATION_NOT_FOUND', 'Notificación inexistente');
    }
    notificacion.readAt = read ? (notificacion.readAt ?? new Date().toISOString()) : null;
    res.json(notificacion);
  });

  return router;
}
