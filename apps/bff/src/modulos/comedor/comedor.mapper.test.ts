import { describe, expect, it } from 'vitest';
import { fixture } from '../../../test/fixtures';
import { ProblemaError } from '../../comun/problema';
import { reservasAItems } from './comedor.mapper';

const reservas = fixture<{ reservations: Record<string, unknown>[] }>(
  'dining/reservations-me.provisional.json',
);
const vacio = fixture('dining/reservations-me-vacio.provisional.json');
const octubre = { desde: '2026-10-01', hasta: '2026-10-31' };

describe('mapper de Comedor → calendario', () => {
  it('cada reserva es un ítem de todo el día, con id string y el campus como lugar', () => {
    const items = reservasAItems(reservas, octubre);
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      id: 'COMEDOR:1',
      categoria: 'COMEDOR',
      titulo: 'Turno de comedor',
      inicio: '2026-10-05T00:00:00-03:00',
      fin: null,
      todoElDia: true,
      lugar: 'Monserrat',
    });
    expect(items[2]?.lugar).toBe('Recoleta');
  });

  it('sin reservas, lista vacía', () => {
    expect(reservasAItems(vacio, octubre)).toEqual([]);
  });

  it('filtra por el rango: Comedor devuelve todas las reservas', () => {
    const items = reservasAItems(reservas, { desde: '2026-10-06', hasta: '2026-10-10' });
    expect(items.map((i) => i.id)).toEqual(['COMEDOR:7']);
  });

  it('no filtra por estado ni por ningún otro campo', () => {
    const conEstado = {
      reservations: reservas.reservations.map((r) => ({ ...r, status: 'CANCELLED' })),
    };
    expect(reservasAItems(conEstado, octubre)).toHaveLength(3);
  });

  it('sin campus, el lugar es null; si solo viene en el slot, se usa ese', () => {
    const [r] = reservas.reservations;
    const sinCampus = { ...r, campus: undefined, slot: { date: '2026-10-05' } };
    const soloSlot = { ...r, campus: undefined };
    expect(reservasAItems({ reservations: [sinCampus] }, octubre)[0]?.lugar).toBeNull();
    expect(reservasAItems({ reservations: [soloSlot] }, octubre)[0]?.lugar).toBe('Monserrat');
  });

  it('una respuesta sin `reservations` es 502 de COMEDOR', () => {
    try {
      reservasAItems([], octubre);
      expect.unreachable();
    } catch (e) {
      expect((e as ProblemaError).aProblema()).toMatchObject({ status: 502, modulo: 'COMEDOR' });
    }
  });
});
