import { describe, expect, it } from 'vitest';
import { diaDe, diasEntre, esFechaValida, horaDe, hoy, moverPeriodo, rangoVisible } from './fechas';

describe('fechas del calendario', () => {
  it('hoy es el día en Argentina, no en UTC', () => {
    expect(hoy(new Date('2026-10-05T02:00:00Z'))).toBe('2026-10-04');
  });

  it('día y hora de un instante, en Argentina', () => {
    expect(diaDe('2026-10-12T21:00:00Z')).toBe('2026-10-12');
    expect(horaDe('2026-10-12T18:00:00-03:00')).toBe('18:00');
    expect(diaDe('2026-10-05T00:00:00-03:00')).toBe('2026-10-05');
  });

  it('el rango del mes empieza el lunes anterior y termina el domingo posterior', () => {
    expect(rangoVisible('mes', '2026-10-15')).toEqual({ desde: '2026-09-28', hasta: '2026-11-01' });
    expect(diasEntre('2026-09-28', '2026-11-01')).toHaveLength(35);
  });

  it('el rango de la semana va de lunes a domingo', () => {
    expect(rangoVisible('semana', '2026-10-08')).toEqual({
      desde: '2026-10-05',
      hasta: '2026-10-11',
    });
  });

  it('mueve de mes cruzando el año, y de semana', () => {
    expect(moverPeriodo('mes', '2026-12-20', 1)).toBe('2027-01-01');
    expect(moverPeriodo('mes', '2026-01-20', -1)).toBe('2025-12-01');
    expect(moverPeriodo('semana', '2026-10-08', 1)).toBe('2026-10-15');
  });

  it('valida fechas de la URL', () => {
    expect(esFechaValida('2026-02-30')).toBe(false);
    expect(esFechaValida('hola')).toBe(false);
    expect(esFechaValida('2026-02-28')).toBe(true);
  });
});
