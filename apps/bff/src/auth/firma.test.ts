import { describe, expect, it } from 'vitest';
import { firmar, verificarFirma, type PedidoFirmado } from './firma';

const SECRETO = 'secreto-de-prueba';
const AHORA = 1_794_970_360_774;

// Calculada aparte con openssl, sobre "GET\n/api/v1/me\nalumno-1\ncorr-1\n1794970360774"
const FIRMA = '6e11fa5ea6eb4ab6bca37921448312dfb00764f9fe56feca7db4555fe96fa9fc';

const pedido = (cambios: Partial<PedidoFirmado> = {}): PedidoFirmado => ({
  metodo: 'GET',
  ruta: '/api/v1/me',
  userId: 'alumno-1',
  correlationId: 'corr-1',
  timestamp: String(AHORA),
  firma: FIRMA,
  ...cambios,
});

describe('firma del Gateway (X-Core-Signature)', () => {
  it('calcula el HMAC-SHA256 como CORE', () => {
    expect(firmar(SECRETO, pedido())).toBe(FIRMA);
  });

  it('una firma correcta y reciente es válida', () => {
    expect(verificarFirma(SECRETO, pedido(), AHORA)).toBe(true);
  });

  it('la ruta se firma sin la query', () => {
    expect(verificarFirma(SECRETO, pedido({ ruta: '/api/v1/me?x=1' }), AHORA)).toBe(true);
  });

  it('acepta la firma en mayúsculas', () => {
    expect(verificarFirma(SECRETO, pedido({ firma: FIRMA.toUpperCase() }), AHORA)).toBe(true);
  });

  it.each([
    ['otro método', { metodo: 'POST' }],
    ['otra ruta', { ruta: '/api/v1/calendario' }],
    ['otro alumno', { userId: 'alumno-2' }],
    ['otro correlation id', { correlationId: 'corr-2' }],
    ['otro timestamp', { timestamp: String(AHORA + 1) }],
    ['firma alterada', { firma: FIRMA.replace(/^./, '0') }],
    ['firma con otro largo', { firma: FIRMA.slice(2) }],
    ['firma que no es hexadecimal', { firma: 'z'.repeat(64) }],
  ])('%s → inválida', (_caso, cambios) => {
    expect(verificarFirma(SECRETO, pedido(cambios), AHORA)).toBe(false);
  });

  it('con otro secreto es inválida', () => {
    expect(verificarFirma('otro-secreto', pedido(), AHORA)).toBe(false);
  });

  it.each([
    ['más de 5 minutos atrás', AHORA + 5 * 60_000 + 1],
    ['más de 5 minutos adelante', AHORA - 5 * 60_000 - 1],
  ])('timestamp de %s → inválida', (_caso, ahora) => {
    expect(verificarFirma(SECRETO, pedido(), ahora)).toBe(false);
  });

  it('justo 5 minutos atrás todavía vale', () => {
    expect(verificarFirma(SECRETO, pedido(), AHORA + 5 * 60_000)).toBe(true);
  });

  it.each([
    ['sin firma', { firma: undefined }],
    ['sin timestamp', { timestamp: undefined }],
    ['timestamp que no es un número', { timestamp: '17949x' }],
    ['sin X-User-Id', { userId: undefined }],
    ['sin X-Correlation-Id', { correlationId: undefined }],
  ])('%s → inválida', (_caso, cambios) => {
    expect(verificarFirma(SECRETO, pedido(cambios), AHORA)).toBe(false);
  });
});
