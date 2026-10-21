import type { ItemCalendario } from '@uadenet/api-types';
import { aHoraArgentina, type Rango, solapa } from '../../calendario/rango';
import { idOpaco, parsearOrigen } from '../comun';
import { TurnosComedor } from './comedor.origen';

/**
 * Turnos de comedor → ítems de calendario. Las horas llegan en UTC y se pasan a Argentina.
 * El lugar es el nombre de la sede según Backoffice (`sedes`: siteId → nombre); si no se
 * pudo resolver, queda en null. No se filtra por estado; se recorta al rango pedido.
 */
export function turnosAItems(
  datos: unknown,
  rango: Rango,
  sedes: ReadonlyMap<string, string>,
): ItemCalendario[] {
  return parsearOrigen('COMEDOR', TurnosComedor, datos)
    .items.filter((t) => solapa(rango, t.startAt, t.endAt ?? t.startAt))
    .map((t) => ({
      id: `COMEDOR:${idOpaco(t.id)}`,
      categoria: 'COMEDOR',
      titulo: 'Turno de comedor',
      inicio: aHoraArgentina(t.startAt),
      fin: t.endAt ? aHoraArgentina(t.endAt) : null,
      todoElDia: false,
      lugar: (t.siteId && sedes.get(t.siteId)) ?? null,
    }));
}
