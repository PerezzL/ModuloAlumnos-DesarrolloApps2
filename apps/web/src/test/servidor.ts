import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { calendarioOctubre } from './calendario';

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

/** Saldo simulado de CORE */
export const wallet = {
  balance: '13500.00',
  transacciones: Array.from({ length: 12 }, (_, i) => ({
    transactionId: `tx-${i + 1}`,
    status: 'POSTED',
    type: i % 3 === 0 ? 'CREDIT' : 'DEBIT',
    concept: i % 3 === 0 ? 'TOP_UP' : 'STORE_PURCHASE',
    amount: `${(i + 1) * 100}.00`,
    currency: 'ARS',
    createdAt: `2026-09-${String(28 - i).padStart(2, '0')}T12:00:00.000Z`,
  })),
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
];

export const handlersBff = [
  http.get(`${BFF}/calendario`, () => HttpResponse.json(calendarioOctubre)),
];

export const servidor = setupServer(...handlersCore, ...handlersSaldo, ...handlersBff);

export function reiniciarCore(cookieValida = false) {
  core.cookieValida = cookieValida;
  core.refreshes = 0;
  core.logouts = 0;
}
