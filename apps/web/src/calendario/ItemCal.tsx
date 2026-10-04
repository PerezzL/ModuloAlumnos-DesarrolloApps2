import type { ItemCalendario } from '@uadenet/api-types';
import { cn } from '@/lib/utils';
import { CATEGORIAS } from './categorias';
import { diaDe, horaDe } from './fechas';

/**
 * Un ítem del calendario. Es informativo: no navega a ningún lado. Si ocupa varios días, la
 * hora de inicio se muestra solo el primero (`dia` es el día en que se dibuja).
 */
export function ItemCal({
  item,
  dia,
  compacto = false,
}: {
  item: ItemCalendario;
  dia?: string;
  compacto?: boolean;
}) {
  const continua = dia !== undefined && dia !== diaDe(item.inicio);
  const { icono: Icono, singular, clases } = CATEGORIAS[item.categoria];
  const hora = item.todoElDia
    ? 'Todo el día'
    : `${horaDe(item.inicio)}${item.fin ? `–${horaDe(item.fin)}` : ''}`;
  const descripcion = [singular, item.titulo, hora, item.lugar].filter(Boolean).join(' · ');

  return (
    <li
      title={descripcion}
      className={cn('flex min-w-0 gap-1.5 rounded-md border px-1.5 py-1 text-xs', clases)}
    >
      <Icono className="mt-px size-3.5 shrink-0" aria-hidden />
      <span className="sr-only">{singular}: </span>
      <span className="min-w-0 text-texto">
        {!item.todoElDia && !continua && (
          <span className="pr-1 font-semibold">{horaDe(item.inicio)}</span>
        )}
        {continua && <span className="pr-1 text-texto-suave">(continúa)</span>}
        <span className={cn(compacto && 'line-clamp-1')}>{item.titulo}</span>
        {!compacto && (
          <span className="block text-texto-suave">
            {item.todoElDia ? 'Todo el día' : hora}
            {item.lugar && ` · ${item.lugar}`}
          </span>
        )}
      </span>
    </li>
  );
}
