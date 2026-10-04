import { describe, expect, it } from 'vitest';
import { formatearMonto, normalizarMonto } from './monto';

describe('montos como string decimal', () => {
  it('formatea sin pasar por float', () => {
    expect(formatearMonto('13500.00')).toBe('$ 13.500,00');
    expect(formatearMonto('0.5')).toBe('$ 0,50');
    expect(formatearMonto('123456789012.99')).toBe('$ 123.456.789.012,99');
    expect(formatearMonto('-2500.00')).toBe('-$ 2.500,00');
  });

  it('un importe que en float pierde precisión se muestra exacto', () => {
    expect(formatearMonto('9007199254740993.01')).toBe('$ 9.007.199.254.740.993,01');
  });

  it.each([
    ['5000', '5000.00'],
    ['5000.5', '5000.50'],
    ['5.000,50', '5000.50'],
    ['5000,5', '5000.50'],
    ['0,01', '0.01'],
  ])('normaliza %s → %s', (entrada, salida) => {
    expect(normalizarMonto(entrada)).toBe(salida);
  });

  it.each(['', '0', '0,00', '-5', 'abc', '5,001', '1e3', '5.00.0'])('rechaza %s', (entrada) => {
    expect(normalizarMonto(entrada)).toBeNull();
  });
});
