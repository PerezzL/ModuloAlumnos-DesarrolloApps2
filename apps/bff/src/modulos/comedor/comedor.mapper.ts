import type { ItemCalendario } from '@uadenet/api-types';
import { inicioDelDia, type Rango, solapaDias } from '../../calendario/rango';
import { idOpaco, parsearOrigen } from '../comun';
import { ReservasComedor } from './comedor.origen';

/**
 * Reservas de comedor → ítems de calendario. Hoy el turno trae solo la fecha, así que va como
 * ítem de todo el día; cuando Comedor agregue la hora, cambia solo este mapper. Se cargan
 * todas las reservas, sin filtrar por estado, y se recortan al rango (Comedor no filtra).
 */
export function reservasAItems(datos: unknown, rango: Rango): ItemCalendario[] {
  return parsearOrigen('COMEDOR', ReservasComedor, datos)
    .reservations.filter((r) => solapaDias(rango, r.slot.date))
    .map((r) => ({
      id: `COMEDOR:${idOpaco(r.id)}`,
      categoria: 'COMEDOR',
      titulo: 'Turno de comedor',
      inicio: inicioDelDia(r.slot.date),
      fin: null,
      todoElDia: true,
      lugar: r.campus?.name ?? r.slot.campus?.name ?? null,
    }));
}
