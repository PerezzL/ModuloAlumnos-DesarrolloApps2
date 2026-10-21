import { describe, expect, it } from 'vitest';
import { fixture } from '../../../test/fixtures';
import { ProblemaError } from '../../comun/problema';
import { turnosAItems } from './comedor.mapper';

const turnos = fixture<{ items: Record<string, unknown>[] }>('dining/calendar-me.json');
const vacio = fixture('dining/calendar-me-vacio.json');
const octubre = { desde: '2026-10-01', hasta: '2026-10-31' };
const MONSERRAT = '3e9b0a12-55cc-4d77-9a01-6b2f8c4e1d90';
const RECOLETA = '7b1d3f5a-9c2e-4a6b-8d0f-2e4a6c8b0d12';
const sedes = new Map([
  [MONSERRAT, 'Sede Monserrat'],
  [RECOLETA, 'Sede Recoleta'],
]);

describe('mapper de Comedor → calendario', () => {
  it('cada turno va con su hora en Argentina y la sede como lugar', () => {
    const items = turnosAItems(turnos, octubre, sedes);
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      id: 'COMEDOR:b3f1c2e0-6a4d-4e1b-9c2f-1d7e8a5b3c01',
      categoria: 'COMEDOR',
      titulo: 'Turno de comedor',
      inicio: '2026-10-05T12:00:00-03:00',
      fin: '2026-10-05T12:45:00-03:00',
      todoElDia: false,
      lugar: 'Sede Monserrat',
    });
    expect(items[2]?.lugar).toBe('Sede Recoleta');
  });

  it('sin turnos, lista vacía', () => {
    expect(turnosAItems(vacio, octubre, sedes)).toEqual([]);
  });

  it('recorta al rango, en hora de Argentina', () => {
    const items = turnosAItems(turnos, { desde: '2026-10-06', hasta: '2026-10-10' }, sedes);
    expect(items.map((i) => i.id)).toEqual(['COMEDOR:c7a2d4f1-8b3e-4c5a-a1d6-2e9f0b7c4d02']);
    // 22:30 del 31/10 en Argentina es 01:30Z del 1/11: igual es de octubre
    const tarde = { ...turnos.items[0], startAt: '2026-11-01T01:30:00.000Z', endAt: null };
    expect(turnosAItems({ items: [tarde] }, octubre, sedes)).toHaveLength(1);
  });

  it('no filtra por estado', () => {
    const otroEstado = { items: turnos.items.map((t) => ({ ...t, status: 'CANCELLED' })) };
    expect(turnosAItems(otroEstado, octubre, sedes)).toHaveLength(3);
  });

  it('una sede que no se pudo resolver deja el lugar en null', () => {
    expect(turnosAItems(turnos, octubre, new Map())[0]?.lugar).toBeNull();
    const sinSede = { ...turnos.items[0], siteId: null };
    expect(turnosAItems({ items: [sinSede] }, octubre, sedes)[0]?.lugar).toBeNull();
  });

  it('sin `endAt`, el turno no tiene fin', () => {
    const sinFin = { ...turnos.items[0], endAt: null };
    expect(turnosAItems({ items: [sinFin] }, octubre, sedes)[0]?.fin).toBeNull();
  });

  it.each([
    ['sin `items`', { reservations: [] }],
    ['`startAt` sin zona', { items: [{ ...turnos.items[0], startAt: '2026-10-05T12:00:00' }] }],
  ])('una respuesta %s es 502 de COMEDOR', (_caso, datos) => {
    try {
      turnosAItems(datos, octubre, sedes);
      expect.unreachable();
    } catch (e) {
      expect((e as ProblemaError).aProblema()).toMatchObject({ status: 502, modulo: 'COMEDOR' });
    }
  });
});
