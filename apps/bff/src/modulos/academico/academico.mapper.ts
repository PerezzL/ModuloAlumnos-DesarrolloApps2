import type { ItemCalendario } from '@uadenet/api-types';
import { inicioDelDia, type Rango, solapaDias } from '../../calendario/rango';
import { idOpaco, parsearOrigen } from '../comun';
import { TurnosExamen } from './academico.origen';

/**
 * Turnos de examen → ítems de calendario de todo el día. `inicio` y `fin` son las 00:00 del
 * primer y del último día de la ventana (ambos inclusive). Se quedan los que se solapan con
 * el rango, porque el Módulo 9 no filtra por fecha.
 */
export function turnosAItems(datos: unknown, rango: Rango): ItemCalendario[] {
  return parsearOrigen('GESTION_ACADEMICA', TurnosExamen, datos)
    .filter((t) => solapaDias(rango, t.fechaInicio, t.fechaFin))
    .map((t) => ({
      id: `EXAMEN:${idOpaco(t.id)}`,
      categoria: 'EXAMEN',
      titulo: t.nombre,
      inicio: inicioDelDia(t.fechaInicio),
      fin: inicioDelDia(t.fechaFin),
      todoElDia: true,
      lugar: null,
    }));
}
