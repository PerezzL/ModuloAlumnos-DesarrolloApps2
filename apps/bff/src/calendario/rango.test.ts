import { describe, expect, it } from 'vitest';
import { aHoraArgentina, inicioDelDia, solapa, solapaDias, sumarDias } from './rango';

const octubre = { desde: '2026-10-01', hasta: '2026-10-31' };

describe('fechas del calendario', () => {
  it('inicio del día en Argentina', () => {
    expect(inicioDelDia('2026-10-05')).toBe('2026-10-05T00:00:00-03:00');
  });

  it('convierte un instante UTC a hora de Argentina sin cambiar el instante', () => {
    const ar = aHoraArgentina('2026-10-12T21:00:00.000Z');
    expect(ar).toBe('2026-10-12T18:00:00-03:00');
    expect(Date.parse(ar)).toBe(Date.parse('2026-10-12T21:00:00.000Z'));
  });

  it('suma días cruzando el fin de mes', () => {
    expect(sumarDias('2026-10-31', 1)).toBe('2026-11-01');
  });

  it('un evento que empieza antes del rango y termina adentro se solapa', () => {
    expect(solapa(octubre, '2026-09-30T18:00:00Z', '2026-10-02T23:00:00Z')).toBe(true);
  });

  it('el último día del rango es inclusive, en hora de Argentina', () => {
    // 31/10 23:30 en Argentina = 01/11 02:30 UTC
    expect(solapa(octubre, '2026-11-01T02:30:00Z')).toBe(true);
    expect(solapa(octubre, '2026-11-01T03:00:00Z')).toBe(false);
  });

  it('solapamiento por días', () => {
    expect(solapaDias(octubre, '2026-09-28', '2026-10-02')).toBe(true);
    expect(solapaDias(octubre, '2026-11-01')).toBe(false);
  });
});
