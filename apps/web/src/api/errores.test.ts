import { describe, expect, it } from 'vitest';
import { datosDe, describirError, ErrorApi, ErrorRed, errorDeRespuesta } from './errores';

const problema = (status: number, code: string, extra = {}) =>
  new ErrorApi({ title: 't', status, code, ...extra });

describe('describirError', () => {
  it('503 nombra el módulo caído', () => {
    const d = describirError(problema(503, 'UPSTREAM_UNAVAILABLE', { modulo: 'COMEDOR' }));
    expect(d.tipo).toBe('caido');
    expect(d.mensaje).toMatch(/Comedor no está disponible/);
  });

  it('502 es respuesta inválida y 504 es demora', () => {
    expect(describirError(problema(502, 'UPSTREAM_INVALID')).tipo).toBe('invalido');
    expect(describirError(problema(504, 'UPSTREAM_TIMEOUT')).tipo).toBe('demora');
  });

  it('sin `modulo`, usa la fuente que le pasa la pantalla', () => {
    const d = describirError(problema(503, 'UPSTREAM_UNAVAILABLE'), 'El saldo');
    expect(d.mensaje).toMatch(/^El saldo no está disponible/);
  });

  it('conserva el correlationId para reportar', () => {
    const d = describirError(problema(504, 'UPSTREAM_TIMEOUT', { correlationId: 'corr-9' }));
    expect(d.correlationId).toBe('corr-9');
  });

  it('un error de red no se confunde con un error del servidor', () => {
    expect(describirError(new ErrorRed()).tipo).toBe('sin-conexion');
  });
});

describe('errorDeRespuesta', () => {
  it('sin problem+json arma uno con el status y el correlation id del header', () => {
    const e = errorDeRespuesta(500, 'texto', 'corr-1');
    expect(e.problema).toMatchObject({ status: 500, code: 'HTTP_500', correlationId: 'corr-1' });
  });
});

describe('datosDe', () => {
  it('devuelve data si la respuesta es exitosa', async () => {
    const r = await datosDe(Promise.resolve({ data: 1, response: new Response(null) }));
    expect(r).toBe(1);
  });

  it('lanza ErrorApi con el problem+json', async () => {
    const llamada = Promise.resolve({
      error: { title: 'x', status: 503, code: 'UPSTREAM_UNAVAILABLE' },
      response: new Response(null, { status: 503 }),
    });
    await expect(datosDe(llamada)).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('lanza ErrorRed si no hubo respuesta', async () => {
    await expect(datosDe(Promise.reject(new TypeError('fetch failed')))).rejects.toBeInstanceOf(
      ErrorRed,
    );
  });
});
