import { describe, expect, it } from 'vitest';
import { idsDeCarrera } from './jwt.guard';

describe('claim `careerIds` del token de CORE', () => {
  it('ids de texto o numéricos → ids opacos de texto', () => {
    expect(idsDeCarrera(['3', 12])).toEqual(['3', '12']);
  });

  it('una lista vacía queda vacía (Backoffice decide)', () => {
    expect(idsDeCarrera([])).toEqual([]);
  });

  it.each([undefined, null, '3', 3, { id: '3' }])('%j no es una lista: se ignora', (claim) => {
    expect(idsDeCarrera(claim)).toBeUndefined();
  });

  it('descarta los elementos que no son ids', () => {
    expect(idsDeCarrera(['3', null, { id: 4 }, 5])).toEqual(['3', '5']);
  });
});
