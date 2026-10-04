import type { ItemCalendario } from '@uadenet/api-types';
import { diaDe } from './fechas';

/**
 * Reparte los ítems en los días visibles. Un ítem de varios días (un turno de examen, un
 * evento que cruza la medianoche) aparece en cada día que ocupa.
 */
export function itemsPorDia(items: ItemCalendario[], dias: string[]) {
  const porDia = new Map<string, ItemCalendario[]>(dias.map((d) => [d, []]));
  for (const item of items) {
    const desde = diaDe(item.inicio);
    const hasta = item.fin ? diaDe(item.fin) : desde;
    for (const dia of dias) {
      if (dia >= desde && dia <= hasta) porDia.get(dia)!.push(item);
    }
  }
  return porDia;
}
