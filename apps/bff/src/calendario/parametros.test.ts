import { describe, expect, it } from 'vitest';
import { parsearCategorias } from './parametros';

describe('parsearCategorias', () => {
  it('sin el parámetro, las tres', () => {
    expect(parsearCategorias(undefined)).toEqual(['COMEDOR', 'EVENTO', 'EXAMEN']);
  });

  it('sin repetidos y en orden fijo', () => {
    expect(parsearCategorias('EXAMEN,COMEDOR,EXAMEN')).toEqual(['COMEDOR', 'EXAMEN']);
  });

  it('vacío o desconocido es 400', () => {
    expect(() => parsearCategorias('')).toThrow(/categorias/);
    expect(() => parsearCategorias('comedor')).toThrow(/desconocida/);
    expect(() => parsearCategorias(['COMEDOR', 'EVENTO'])).toThrow();
  });
});
