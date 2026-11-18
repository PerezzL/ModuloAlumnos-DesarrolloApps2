import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Logger } from '@nestjs/common';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cargarConfig } from '../config/config';
import { correlationMiddleware } from '../comun/contexto';
import { ProblemaError } from '../comun/problema';
import { envDePrueba } from '../../test/env';
import { GatewayClient, RespuestaModuloError } from './gateway.client';

const GW = envDePrueba.GATEWAY_URL;
const server = setupServer();
const client = new GatewayClient(cargarConfig({ ...envDePrueba, GATEWAY_TIMEOUT_MS: '100' }));

/** Corre `fn` dentro del contexto de un request con estos headers. */
function enRequest<T>(headers: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const req = {
    headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
    header(nombre: string) {
      return this.headers[nombre.toLowerCase()];
    },
  };
  const res = { setHeader: () => undefined };
  return new Promise((resolve, reject) => {
    correlationMiddleware(req as never, res as never, () => {
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

describe('GatewayClient', () => {
  it('llama por el Gateway con el prefijo del módulo, reenviando token y correlation id', async () => {
    let recibido: Request | undefined;
    server.use(
      http.get(`${GW}/api/v1/events/api/v1/eventos`, ({ request }) => {
        recibido = request;
        return HttpResponse.json([{ id: 1 }]);
      }),
    );

    const datos = await enRequest(
      { Authorization: 'Bearer abc', 'X-Correlation-Id': 'corr-1' },
      () =>
        client.get('EVENTOS', '/api/v1/eventos', { query: { desde: '2026-10-01', x: undefined } }),
    );

    expect(datos).toEqual([{ id: 1 }]);
    expect(recibido?.headers.get('authorization')).toBe('Bearer abc');
    expect(recibido?.headers.get('x-correlation-id')).toBe('corr-1');
    expect(new URL(recibido!.url).search).toBe('?desde=2026-10-01');
  });

  it('503 del Gateway → 503 UPSTREAM_UNAVAILABLE con el módulo', async () => {
    server.use(http.get(`${GW}/api/v1/dining/*`, () => new HttpResponse(null, { status: 503 })));
    const error = await capturar(client.get('COMEDOR', '/reservations/me'));
    expect(error.aProblema()).toMatchObject({
      status: 503,
      code: 'UPSTREAM_UNAVAILABLE',
      modulo: 'COMEDOR',
    });
  });

  it('loguea en debug el cuerpo de error que manda el Gateway', async () => {
    const debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    const problema = { status: 503, code: 'UPSTREAM_UNAVAILABLE', detail: 'dining caído' };
    server.use(
      http.get(`${GW}/api/v1/dining/*`, () => HttpResponse.json(problema, { status: 503 })),
    );

    await capturar(client.get('COMEDOR', '/reservations/me'));

    expect(debug).toHaveBeenCalledWith(
      { modulo: 'COMEDOR', status: 503, cuerpo: problema },
      'Respuesta de error del Gateway',
    );
    debug.mockRestore();
  });

  it('Gateway inalcanzable → 503 UPSTREAM_UNAVAILABLE', async () => {
    server.use(http.get(`${GW}/api/v1/dining/*`, () => HttpResponse.error()));
    const error = await capturar(client.get('COMEDOR', '/reservations/me'));
    expect(error.aProblema()).toMatchObject({ status: 503, code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('502 del Gateway → 502 UPSTREAM_INVALID', async () => {
    server.use(http.get(`${GW}/api/v1/store/*`, () => new HttpResponse(null, { status: 502 })));
    const error = await capturar(client.get('TIENDA', '/orders/me'));
    expect(error.aProblema()).toMatchObject({
      status: 502,
      code: 'UPSTREAM_INVALID',
      modulo: 'TIENDA',
    });
  });

  it('respuesta 200 que no es JSON → 502 UPSTREAM_INVALID', async () => {
    server.use(http.get(`${GW}/api/v1/store/*`, () => HttpResponse.text('<html>')));
    const error = await capturar(client.get('TIENDA', '/orders/me'));
    expect(error.aProblema()).toMatchObject({ status: 502, code: 'UPSTREAM_INVALID' });
  });

  it('504 del Gateway → 504 UPSTREAM_TIMEOUT', async () => {
    server.use(http.get(`${GW}/api/v1/academic/*`, () => new HttpResponse(null, { status: 504 })));
    const error = await capturar(client.get('GESTION_ACADEMICA', '/periodos'));
    expect(error.aProblema()).toMatchObject({ status: 504, code: 'UPSTREAM_TIMEOUT' });
  });

  it('sin respuesta dentro del timeout → 504 UPSTREAM_TIMEOUT', async () => {
    server.use(
      http.get(`${GW}/api/v1/academic/*`, async () => {
        await delay(500);
        return HttpResponse.json({});
      }),
    );
    const error = await capturar(client.get('GESTION_ACADEMICA', '/periodos'));
    expect(error.aProblema()).toMatchObject({
      status: 504,
      code: 'UPSTREAM_TIMEOUT',
      modulo: 'GESTION_ACADEMICA',
    });
  });

  it('un 4xx del módulo llega al adaptador con el status y el cuerpo de origen', async () => {
    server.use(
      http.post(`${GW}/api/v1/academic/*`, () =>
        HttpResponse.json({ code: 'SIN_CUPO' }, { status: 409 }),
      ),
    );
    const error = await capturar(client.post('GESTION_ACADEMICA', '/cursos/c1/inscripciones', {}));
    expect(error).toBeInstanceOf(RespuestaModuloError);
    expect((error as RespuestaModuloError).estadoOrigen).toBe(409);
    expect((error as RespuestaModuloError).cuerpoOrigen).toEqual({ code: 'SIN_CUPO' });
  });

  it('no reintenta un POST que falla', async () => {
    let llamadas = 0;
    server.use(
      http.post(`${GW}/api/v1/academic/*`, () => {
        llamadas++;
        return new HttpResponse(null, { status: 503 });
      }),
    );
    await capturar(client.post('GESTION_ACADEMICA', '/cursos/c1/inscripciones', { alumnoId: 'a' }));
    expect(llamadas).toBe(1);
  });
});
