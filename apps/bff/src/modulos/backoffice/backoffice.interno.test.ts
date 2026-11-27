import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cargarConfig } from '../../config/config';
import { correlationMiddleware } from '../../comun/contexto';
import { ProblemaError } from '../../comun/problema';
import { RespuestaModuloError } from '../../gateway/pedido';
import { TokenServicio } from '../../servicio/token-servicio';
import { envDePrueba } from '../../../test/env';
import { BackofficeInternoClient } from './backoffice.interno';

const BO = envDePrueba.BACKOFFICE_INTERNAL_URL;
const server = setupServer();

function nuevo() {
  const config = cargarConfig({ ...envDePrueba, GATEWAY_TIMEOUT_MS: '100' });
  return new BackofficeInternoClient(config, new TokenServicio(config));
}

/** CORE emitiendo tokens numerados */
function core() {
  let n = 0;
  server.use(
    http.post(envDePrueba.SERVICE_TOKEN_URL, () =>
      HttpResponse.json({ accessToken: `servicio-${++n}`, expiresIn: 900 }),
    ),
  );
}

/** Corre `fn` dentro del contexto de un request con el token del alumno y un correlation id */
function enRequest<T>(fn: () => Promise<T>): Promise<T> {
  const headers: Record<string, string> = {
    authorization: 'Bearer token-del-alumno',
    'x-correlation-id': 'corr-bo',
  };
  const req = { headers, header: (nombre: string) => headers[nombre.toLowerCase()] };
  return new Promise((resolve, reject) => {
    correlationMiddleware(req as never, { setHeader: () => undefined } as never, () => {
      fn().then(resolve, reject);
    });
  });
}

async function capturar(promesa: Promise<unknown>): Promise<ProblemaError> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof ProblemaError) return error;
    throw error;
  }
  throw new Error('Se esperaba un error');
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('BackofficeInternoClient', () => {
  it('llama directo a /internal/v1 con el token de servicio, nunca con el del alumno', async () => {
    core();
    let recibido: Request | undefined;
    server.use(
      http.get(`${BO}/sites`, ({ request }) => {
        recibido = request;
        return HttpResponse.json({ items: [], nextCursor: null });
      }),
    );
    const datos = await enRequest(() =>
      nuevo().get('/sites', { query: { limit: 100, cursor: undefined } }),
    );
    expect(datos).toEqual({ items: [], nextCursor: null });
    expect(recibido?.headers.get('authorization')).toBe('Bearer servicio-1');
    expect(recibido?.headers.get('x-correlation-id')).toBe('corr-bo');
    expect(new URL(recibido!.url).search).toBe('?limit=100');
  });

  it('si Backoffice rechaza el token, pide otro y reintenta una vez', async () => {
    core();
    const usados: (string | null)[] = [];
    server.use(
      http.get(`${BO}/users/:userId`, ({ request }) => {
        usados.push(request.headers.get('authorization'));
        return usados.length === 1
          ? new HttpResponse(null, { status: 401 })
          : HttpResponse.json({ firstName: 'Ana' });
      }),
    );
    expect(await nuevo().get('/users/u-1')).toEqual({ firstName: 'Ana' });
    expect(usados).toEqual(['Bearer servicio-1', 'Bearer servicio-2']);
  });

  it('dos rechazos seguidos → 502 de BACKOFFICE, sin más reintentos', async () => {
    core();
    let llamadas = 0;
    server.use(
      http.get(`${BO}/users/:userId`, () => {
        llamadas++;
        return new HttpResponse(null, { status: 401 });
      }),
    );
    const error = await capturar(nuevo().get('/users/u-1'));
    expect(error.aProblema()).toMatchObject({
      status: 502,
      code: 'UPSTREAM_INVALID',
      modulo: 'BACKOFFICE',
    });
    expect(llamadas).toBe(2);
  });

  it('el 404 llega como RespuestaModuloError para que lo decida el adaptador', async () => {
    core();
    server.use(http.get(`${BO}/users/:userId`, () => new HttpResponse(null, { status: 404 })));
    const error = await capturar(nuevo().get('/users/no-existe'));
    expect(error).toBeInstanceOf(RespuestaModuloError);
    expect((error as RespuestaModuloError).estadoOrigen).toBe(404);
  });

  it('límite de pedidos (429) → 503 de BACKOFFICE', async () => {
    core();
    server.use(
      http.get(`${BO}/sites`, () =>
        HttpResponse.json({ code: 'HTTP_429' }, { status: 429, headers: { 'Retry-After': '30' } }),
      ),
    );
    expect((await capturar(nuevo().get('/sites'))).aProblema()).toMatchObject({
      status: 503,
      code: 'UPSTREAM_UNAVAILABLE',
      modulo: 'BACKOFFICE',
    });
  });

  it('si CORE no da el token, no llama a Backoffice', async () => {
    server.use(
      http.post(envDePrueba.SERVICE_TOKEN_URL, () => new HttpResponse(null, { status: 503 })),
    );
    expect((await capturar(nuevo().get('/sites'))).aProblema()).toMatchObject({
      status: 503,
      modulo: 'CORE',
    });
  });
});
