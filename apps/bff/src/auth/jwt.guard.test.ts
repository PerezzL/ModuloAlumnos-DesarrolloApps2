import { describe, expect, it } from 'vitest';
import { idsDelClaim } from './jwt.guard';

describe('claims `careerIds` y `planIds` del token de CORE', () => {
  it('ids de texto o numéricos → ids opacos de texto', () => {
    expect(idsDelClaim(['3', 12])).toEqual(['3', '12']);
  });

  it('una lista vacía queda vacía (Backoffice decide)', () => {
    expect(idsDelClaim([])).toEqual([]);
  });

  it.each([undefined, null, '3', 3, { id: '3' }])('%j no es una lista: se ignora', (claim) => {
    expect(idsDelClaim(claim)).toBeUndefined();
  });

  it('descarta los elementos que no son ids', () => {
    expect(idsDelClaim(['3', null, { id: 4 }, 5])).toEqual(['3', '5']);
  });
});
