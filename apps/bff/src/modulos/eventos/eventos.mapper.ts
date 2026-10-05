import type { ItemCalendario } from '@uadenet/api-types';
import { aHoraArgentina, type Rango, solapa } from '../../calendario/rango';
import { idOpaco, parsearOrigen } from '../comun';
import { Eventos } from './eventos.origen';

/**
 * Eventos → ítems de calendario. Solo los que tienen `yaInscripto` (calculado por el Módulo 6
 * contra el token del alumno). Se vuelve a filtrar por solapamiento con el rango porque no
 * está confirmado si el `hasta` del módulo es inclusivo.
 */
export function eventosAItems(datos: unknown, rango: Rango): ItemCalendario[] {
  return parsearOrigen('EVENTOS', Eventos, datos)
    .filter((e) => e.yaInscripto)
    .filter((e) => solapa(rango, e.fechaInicio, e.fechaFin ?? e.fechaInicio))
    .map((e) => ({
      id: `EVENTO:${idOpaco(e.id)}`,
      categoria: 'EVENTO',
      titulo: e.titulo,
      inicio: aHoraArgentina(e.fechaInicio),
      fin: e.fechaFin ? aHoraArgentina(e.fechaFin) : null,
      todoElDia: false,
      lugar: [e.locacion?.nombre, e.locacion?.sede].filter(Boolean).join(' — ') || null,
    }));
}
