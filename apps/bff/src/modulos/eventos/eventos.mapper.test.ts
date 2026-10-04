import { describe, expect, it } from 'vitest';
import { fixture } from '../../../test/fixtures';
import { ProblemaError } from '../../comun/problema';
import { eventosAItems } from './eventos.mapper';

const eventos = fixture<Record<string, unknown>[]>('events/eventos.json');
const octubre = { desde: '2026-10-01', hasta: '2026-10-31' };

describe('mapper de Eventos → calendario', () => {
  it('se queda con los inscriptos, con hora de Argentina y lugar resuelto', () => {
    expect(eventosAItems(eventos, octubre)).toEqual([
      {
        id: 'EVENTO:8b0f4e2a-3c1d-4f5e-9a6b-7c8d9e0f1a2b',
        categoria: 'EVENTO',
        titulo: 'Semana de la Ingeniería',
        inicio: '2026-09-30T15:00:00-03:00',
        fin: '2026-10-02T20:00:00-03:00',
        todoElDia: false,
        lugar: 'Aula Magna — Monserrat',
      },
      {
        id: 'EVENTO:65a783d1-d407-442d-8d09-a6d2abfe9321',
        categoria: 'EVENTO',
        titulo: 'Jornada de Desarrollo de Software',
        inicio: '2026-10-12T18:00:00-03:00',
        fin: '2026-10-12T21:00:00-03:00',
        todoElDia: false,
        lugar: 'Auditorio 2 — Monserrat',
      },
    ]);
  });

  it('el evento que cruza el límite del mes aparece en los dos meses', () => {
    const septiembre = eventosAItems(eventos, { desde: '2026-09-01', hasta: '2026-09-30' });
    expect(septiembre.map((i) => i.titulo)).toEqual(['Semana de la Ingeniería']);
  });

  it('descarta lo que el módulo devuelva fuera del rango (por si `hasta` es exclusivo o no)', () => {
    expect(eventosAItems(eventos, { desde: '2026-11-08', hasta: '2026-11-30' })).toEqual([]);
  });

  it('sin locación, el lugar es null; con solo el nombre, el nombre', () => {
    const base = { ...eventos[1], yaInscripto: true };
    expect(eventosAItems([{ ...base, locacion: null }], octubre)[0]?.lugar).toBeNull();
    expect(eventosAItems([{ ...base, locacion: { nombre: 'SUM' } }], octubre)[0]?.lugar).toBe(
      'SUM',
    );
  });

  it('una respuesta que no es una lista es 502 de EVENTOS', () => {
    try {
      eventosAItems({ eventos: [] }, octubre);
      expect.unreachable();
    } catch (e) {
      expect((e as ProblemaError).aProblema()).toMatchObject({ status: 502, modulo: 'EVENTOS' });
    }
  });
});
