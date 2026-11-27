import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cargarConfig } from '../config/config';
import { ProblemaError } from '../comun/problema';
import { envDePrueba } from '../../test/env';
import { TokenServicio } from './token-servicio';

const URL_TOKEN = envDePrueba.SERVICE_TOKEN_URL;
const server = setupServer();

function nuevo() {
  const tokens = new TokenServicio(cargarConfig({ ...envDePrueba, GATEWAY_TIMEOUT_MS: '100' }));
  let reloj = 1_000_000;
  tokens.ahora = () => reloj;
  return { tokens, avanzar: (ms: number) => (reloj += ms) };
}

/** CORE emitiendo tokens numerados; cuenta los pedidos y guarda el último body */
function core(expiresIn = 900) {
  const estado = { pedidos: 0, body: undefined as unknown };
  server.use(
    http.post(URL_TOKEN, async ({ request }) => {
      estado.pedidos++;
      estado.body = await request.json();
      return HttpResponse.json({
        accessToken: `token-${estado.pedidos}`,
        expiresIn,
        tokenType: 'Bearer',
      });
    }),
  );
  return estado;
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

describe('TokenServicio', () => {
  it('pide el token con el clientId y el clientSecret de la config', async () => {
    const estado = core();
    const { tokens } = nuevo();
    expect(await tokens.obtener()).toBe('token-1');
    expect(estado.body).toEqual({
      clientId: 'student-service',
      clientSecret: 'secreto-de-servicio-de-prueba',
    });
  });

  it('lo reusa hasta un minuto antes de que venza', async () => {
    const estado = core(900);
    const { tokens, avanzar } = nuevo();
    await tokens.obtener();
    avanzar(839_000);
    expect(await tokens.obtener()).toBe('token-1');
    avanzar(2_000);
    expect(await tokens.obtener()).toBe('token-2');
    expect(estado.pedidos).toBe(2);
  });

  it('con pedidos simultáneos pide un solo token', async () => {
    const estado = core();
    const { tokens } = nuevo();
    const resultados = await Promise.all([tokens.obtener(), tokens.obtener(), tokens.obtener()]);
    expect(resultados).toEqual(['token-1', 'token-1', 'token-1']);
    expect(estado.pedidos).toBe(1);
  });

  it('invalidar descarta el token rechazado y el siguiente pide otro', async () => {
    core();
    const { tokens } = nuevo();
    const primero = await tokens.obtener();
    tokens.invalidar('otro-token');
    expect(await tokens.obtener()).toBe(primero);
    tokens.invalidar(primero);
    expect(await tokens.obtener()).toBe('token-2');
  });

  it('credenciales rechazadas → 502 de CORE, y no se cachea el error', async () => {
    server.use(http.post(URL_TOKEN, () => new HttpResponse(null, { status: 401 })));
    const { tokens } = nuevo();
    const error = await capturar(tokens.obtener());
    expect(error.aProblema()).toMatchObject({
      status: 502,
      code: 'UPSTREAM_INVALID',
      modulo: 'CORE',
    });
    core();
    expect(await tokens.obtener()).toBe('token-1');
  });

  it('CORE caído → 503 y respuesta sin token → 502', async () => {
    const { tokens } = nuevo();
    server.use(http.post(URL_TOKEN, () => new HttpResponse(null, { status: 503 })));
    expect((await capturar(tokens.obtener())).aProblema()).toMatchObject({
      status: 503,
      code: 'UPSTREAM_UNAVAILABLE',
      modulo: 'CORE',
    });
    server.use(http.post(URL_TOKEN, () => HttpResponse.json({ expiresIn: 900 })));
    expect((await capturar(tokens.obtener())).aProblema()).toMatchObject({
      status: 502,
      modulo: 'CORE',
    });
  });

  it('si CORE no responde a tiempo → 504', async () => {
    server.use(
      http.post(URL_TOKEN, async () => {
        await delay(500);
        return HttpResponse.json({ accessToken: 'tarde', expiresIn: 900 });
      }),
    );
    const { tokens } = nuevo();
    expect((await capturar(tokens.obtener())).aProblema()).toMatchObject({
      status: 504,
      code: 'UPSTREAM_TIMEOUT',
      modulo: 'CORE',
    });
  });
});
