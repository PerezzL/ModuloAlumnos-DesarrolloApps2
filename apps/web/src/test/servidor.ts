import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { calendarioOctubre } from './calendario';
import { cursadaDetalleBase, cursadasBase, notaDetalleBase } from './cursadas';
import { ofertaBase } from './inscripcion';

export const GW = 'http://gateway.test';
export const BFF = `${GW}/api/v1/student`;

export const usuario = {
  id: 'alumno-opaco-1',
  email: 'v.moreno@uade.edu.ar',
  roles: ['STUDENT'],
  permissions: [],
  status: 'ACTIVE',
};

/** Estado del CORE simulado: si hay cookie de refresh válida y cuántos refresh hubo. */
export const core = { cookieValida: false, refreshes: 0, logouts: 0 };

export const handlersCore = [
  http.post(`${GW}/api/v1/auth/login`, async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string };
    if (email === 'suspendido@uade.edu.ar') {
      return HttpResponse.json({ code: 'AUTH_IDENTITY_SUSPENDED' }, { status: 403 });
    }
    if (email === 'bloqueado@uade.edu.ar') {
      return HttpResponse.json({ code: 'RATE_LIMITED' }, { status: 429 });
    }
    if (password !== 'uade2026') {
      return HttpResponse.json({ code: 'AUTH_INVALID_CREDENTIALS' }, { status: 401 });
    }
    core.cookieValida = true;
    return HttpResponse.json({
      accessToken: 'token-1',
      expiresIn: 900,
      user: { ...usuario, email },
    });
  }),
  http.post(`${GW}/api/v1/auth/refresh`, () => {
    core.refreshes++;
    if (!core.cookieValida) return HttpResponse.json({}, { status: 401 });
    return HttpResponse.json({ accessToken: `token-refrescado-${core.refreshes}`, expiresIn: 900 });
  }),
  http.get(`${GW}/api/v1/auth/me`, () => HttpResponse.json(usuario)),
  http.post(`${GW}/api/v1/auth/logout`, () => {
    core.logouts++;
    core.cookieValida = false;
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(`${BFF}/me`, () =>
    HttpResponse.json({
      id: usuario.id,
      email: usuario.email,
      nombre: 'Valentina',
      apellido: 'Moreno',
    }),
  ),
];

const transaccionesIniciales = () =>
  Array.from({ length: 12 }, (_, i) => ({
    transactionId: `tx-${i + 1}`,
    status: 'POSTED',
    type: i % 3 === 0 ? 'CREDIT' : 'DEBIT',
    concept: i % 3 === 0 ? 'TOP_UP' : 'STORE_PURCHASE',
    amount: `${(i + 1) * 100}.00`,
    currency: 'ARS',
    createdAt: `2026-09-${String(28 - i).padStart(2, '0')}T12:00:00.000Z`,
  }));

/**
 * Saldo simulado de CORE. Las cargas se deduplican por Idempotency-Key como en CORE: la misma
 * key devuelve la respuesta original sin acreditar de nuevo.
 */
export const wallet = {
  balance: '13500.00',
  transacciones: transaccionesIniciales(),
  /** Idempotency-Key → respuesta original */
  cargas: new Map<string, { status: number; cuerpo: Record<string, unknown> }>(),
  acreditaciones: 0,
  /** Keys recibidas, en orden (incluye reintentos) */
  keys: [] as (string | null)[],
  /** Si es > 0, la próxima carga se procesa pero la respuesta "se pierde en la red" */
  perderRespuestas: 0,
};

function reiniciarWallet() {
  Object.assign(wallet, {
    balance: '13500.00',
    transacciones: transaccionesIniciales(),
    cargas: new Map(),
    acreditaciones: 0,
    keys: [],
    perderRespuestas: 0,
  });
}

const sumar = (a: string, b: string) => {
  const centavos = (m: string) => BigInt(m.replace('.', ''));
  const total = centavos(a) + centavos(b);
  return `${total / 100n}.${String(total % 100n).padStart(2, '0')}`;
};

export const handlersSaldo = [
  http.get(`${GW}/api/v1/wallets/me`, () =>
    HttpResponse.json({ userId: usuario.id, balance: wallet.balance, currency: 'ARS' }),
  ),
  http.get(`${GW}/api/v1/wallets/me/transactions`, ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const desde = Number(url.searchParams.get('cursor') ?? 0);
    const hasta = desde + limit;
    return HttpResponse.json({
      items: wallet.transacciones.slice(desde, hasta),
      nextCursor: hasta < wallet.transacciones.length ? String(hasta) : null,
    });
  }),
  http.post(`${GW}/api/v1/wallets/me/top-ups`, async ({ request }) => {
    const key = request.headers.get('idempotency-key');
    wallet.keys.push(key);
    if (!key) {
      return HttpResponse.json(
        { title: 'x', status: 400, code: 'IDEMPOTENCY_KEY_REQUIRED' },
        { status: 400 },
      );
    }
    let guardada = wallet.cargas.get(key);
    if (!guardada) {
      const { amount = '', paymentMethodToken } = (await request.json()) as Record<string, string>;
      const movimiento = {
        transactionId: `tx-carga-${wallet.cargas.size + 1}`,
        type: 'CREDIT',
        concept: 'TOP_UP',
        amount,
        currency: 'ARS',
        createdAt: '2026-10-04T15:00:00.000Z',
      };
      if (paymentMethodToken === 'mock-approved') {
        wallet.acreditaciones++;
        wallet.balance = sumar(wallet.balance, amount);
        wallet.transacciones.unshift({ ...movimiento, status: 'POSTED' });
        guardada = { status: 201, cuerpo: { ...movimiento, status: 'POSTED' } };
      } else if (paymentMethodToken === 'mock-pending') {
        guardada = { status: 202, cuerpo: { ...movimiento, status: 'PENDING' } };
      } else {
        guardada = {
          status: 422,
          cuerpo: { title: 'Carga rechazada', status: 422, code: 'WALLET_TOPUP_REJECTED' },
        };
      }
      wallet.cargas.set(key, guardada);
    }
    if (wallet.perderRespuestas > 0) {
      wallet.perderRespuestas--;
      return HttpResponse.error();
    }
    return HttpResponse.json(guardada.cuerpo, { status: guardada.status });
  }),
];

/** Notificaciones simuladas de CORE, de la más nueva a la más vieja */
const notificacionesIniciales = () => [
  {
    id: 'n-evento',
    type: 'EVENT_REMINDER',
    title: 'Se acerca tu evento',
    message: 'Jornada de Desarrollo de Software — 12 de octubre, 18:00',
    actionUrl: '/events/ev-1',
    read: false,
    createdAt: '2026-10-03T21:00:00.000Z',
  },
  {
    id: 'n-sancion',
    type: 'LIBRARY_PENALTY_APPLIED',
    title: 'Tenés una sanción de biblioteca',
    message: 'Devolviste un libro con 8 días de atraso.',
    actionUrl: '/library/loan-1/penalty',
    read: false,
    createdAt: '2026-09-20T13:00:00.000Z',
  },
  {
    id: 'n-nota',
    type: 'EXAM_RESULT_PUBLISHED',
    title: 'Se publicó tu nota de Bases de Datos I',
    message: '1er parcial: 7 (aprobado)',
    actionUrl: '/teacher/courses/curso-bd1/exams/exam-p1',
    read: true,
    createdAt: '2026-09-15T20:15:00.000Z',
  },
];

export const notificaciones = {
  items: notificacionesIniciales(),
  /** Si es true, PATCH y read-all responden 503 */
  fallarEscrituras: false,
};

function reiniciarNotificaciones() {
  notificaciones.items = notificacionesIniciales();
  notificaciones.fallarEscrituras = false;
}

const noDisponible = () =>
  HttpResponse.json(
    { title: 'Servicio no disponible', status: 503, code: 'UPSTREAM_UNAVAILABLE' },
    { status: 503 },
  );

export const handlersNotificaciones = [
  http.get(`${GW}/api/v1/notifications`, ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const desde = Number(url.searchParams.get('cursor') ?? 0);
    const hasta = desde + limit;
    return HttpResponse.json({
      items: notificaciones.items.slice(desde, hasta),
      nextCursor: hasta < notificaciones.items.length ? String(hasta) : null,
    });
  }),
  http.get(`${GW}/api/v1/notifications/unread-count`, () =>
    HttpResponse.json({ count: notificaciones.items.filter((n) => !n.read).length }),
  ),
  http.patch(`${GW}/api/v1/notifications/:id`, async ({ params, request }) => {
    if (notificaciones.fallarEscrituras) return noDisponible();
    const n = notificaciones.items.find((x) => x.id === params.id);
    if (!n) return HttpResponse.json({ status: 404, code: 'NOT_FOUND' }, { status: 404 });
    n.read = ((await request.json()) as { read: boolean }).read;
    return HttpResponse.json(n);
  }),
  http.post(`${GW}/api/v1/notifications/read-all`, () => {
    if (notificaciones.fallarEscrituras) return noDisponible();
    for (const n of notificaciones.items) n.read = true;
    return new HttpResponse(null, { status: 204 });
  }),
];

export const handlersBff = [
  http.get(`${BFF}/calendario`, () => HttpResponse.json(calendarioOctubre)),
  http.get(`${BFF}/inscripcion/oferta`, () => HttpResponse.json(ofertaBase())),
  http.get(`${BFF}/cursadas`, () => HttpResponse.json({ items: cursadasBase() })),
  http.get(`${BFF}/cursadas/:cursoId`, ({ params }) =>
    HttpResponse.json({ ...cursadaDetalleBase(), cursoId: params.cursoId }),
  ),
  http.get(`${BFF}/cursadas/:cursoId/notas/:notaId`, ({ params }) =>
    HttpResponse.json({ ...notaDetalleBase(), cursoId: params.cursoId, notaId: params.notaId }),
  ),
];

export const servidor = setupServer(
  ...handlersCore,
  ...handlersSaldo,
  ...handlersNotificaciones,
  ...handlersBff,
);

export function reiniciarCore(cookieValida = false) {
  reiniciarWallet();
  reiniciarNotificaciones();
  core.cookieValida = cookieValida;
  core.refreshes = 0;
  core.logouts = 0;
}
