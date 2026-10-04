import { describe, expect, it } from 'vitest';
import { Contrato } from './index.ts';

const contrato = new Contrato();

describe('Contrato', () => {
  it('acepta una respuesta que cumple el schema', () => {
    const r = contrato.validar('get', '/calendario', 200, {
      items: [
        {
          id: 'EVENTO:1',
          categoria: 'EVENTO',
          titulo: 'Charla',
          inicio: '2026-10-08T18:00:00-03:00',
          fin: null,
          todoElDia: false,
          lugar: null,
        },
      ],
      fuentes: [{ categoria: 'EVENTO', estado: 'OK' }],
    });
    expect(r).toEqual({ valido: true, errores: [] });
  });

  it('rechaza campos con tipo o enum inválido', () => {
    const r = contrato.validar('get', '/calendario', 200, {
      items: [{ id: 'x', categoria: 'OTRA', titulo: 'x', inicio: 'ayer', todoElDia: 'no' }],
      fuentes: [],
    });
    expect(r.valido).toBe(false);
    expect(r.errores.join('\n')).toMatch(/categoria/);
  });

  it('resuelve respuestas compartidas por $ref', () => {
    const r = contrato.validar('get', '/me', 401, { title: 'No autenticado', status: 401 });
    expect(r.valido).toBe(false);
    expect(r.errores.join('\n')).toMatch(/code/);
  });

  it('acepta null en campos nullable con allOf', () => {
    const r = contrato.validar('get', '/cursadas/{cursoId}', 200, {
      cursoId: 'c1',
      asignatura: { id: 'a1', nombre: 'Álgebra' },
      periodo: { id: 'p1', nombre: '2C 2026' },
      estado: 'CURSANDO',
      enCurso: true,
      asistencia: null,
      notas: null,
      fuentesConError: ['DOCENTE'],
    });
    expect(r).toEqual({ valido: true, errores: [] });
  });

  it('falla si la operación no existe en el contrato', () => {
    expect(() => contrato.validar('get', '/no-existe', 200, {})).toThrow(/no define/);
  });
});
