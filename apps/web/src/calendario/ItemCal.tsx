import type { ItemCalendario } from '@uadenet/api-types';
import { cn } from '@/lib/utils';
import { CATEGORIAS } from './categorias';
import { horaDe } from './fechas';

/** Un ítem del calendario. Es informativo: no navega a ningún lado. */
export function ItemCal({ item, compacto = false }: { item: ItemCalendario; compacto?: boolean }) {
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
        {!item.todoElDia && <span className="pr-1 font-semibold">{horaDe(item.inicio)}</span>}
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
