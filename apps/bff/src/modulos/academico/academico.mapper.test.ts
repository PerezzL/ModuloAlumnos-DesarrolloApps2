import { describe, expect, it } from 'vitest';
import { fixture } from '../../../test/fixtures';
import { ProblemaError } from '../../comun/problema';
import { turnosAItems } from './academico.mapper';

const turnos = fixture('academic/turnos-examen.provisional.json');
const octubre = { desde: '2026-10-01', hasta: '2026-10-31' };

describe('mapper de Gestión Académica: turnos de examen → calendario', () => {
  it('cada turno del rango es un ítem de todo el día con su ventana', () => {
    expect(turnosAItems(turnos, octubre)).toEqual([
      {
        id: 'EXAMEN:turno-2026-10',
        categoria: 'EXAMEN',
        titulo: 'Mesa especial de octubre 2026',
        inicio: '2026-10-19T00:00:00-03:00',
        fin: '2026-10-23T00:00:00-03:00',
        todoElDia: true,
        lugar: null,
      },
    ]);
  });

  it('incluye un turno que empieza antes del rango y termina adentro', () => {
    const items = turnosAItems(turnos, { desde: '2027-03-01', hasta: '2027-03-31' });
    expect(items.map((i) => i.id)).toEqual(['EXAMEN:turno-2027-02']);
  });

  it('sin turnos en el rango, lista vacía', () => {
    expect(turnosAItems(turnos, { desde: '2026-01-01', hasta: '2026-01-31' })).toEqual([]);
  });

  it('una fecha con formato inesperado es 502 de GESTION_ACADEMICA', () => {
    expect(() =>
      turnosAItems(
        [{ id: 't', nombre: 'x', fechaInicio: '07/12/2026', fechaFin: '19/12/2026' }],
        octubre,
      ),
    ).toThrow(ProblemaError);
    try {
      turnosAItems({}, octubre);
    } catch (e) {
      expect((e as ProblemaError).aProblema()).toMatchObject({
        status: 502,
        modulo: 'GESTION_ACADEMICA',
      });
    }
  });
});
