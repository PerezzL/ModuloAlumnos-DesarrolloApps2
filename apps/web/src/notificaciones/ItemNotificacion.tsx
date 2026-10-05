import type { Notificacion } from '@/core/notificaciones';
import { cn } from '@/lib/utils';
import { varianteDe } from './variantes';

const fecha = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Argentina/Buenos_Aires',
});

/** Un único componente para todas las notificaciones, con variante según `type`. */
export function ItemNotificacion({
  notificacion: n,
  abrir,
}: {
  notificacion: Notificacion;
  abrir: (n: Notificacion) => void;
}) {
  const { etiqueta, icono: Icono, clases } = varianteDe(n.tipo);

  return (
    <li>
      <button
        type="button"
        onClick={() => abrir(n)}
        className={cn(
          'flex w-full gap-3 rounded-item p-3 text-left transition-colors hover:bg-fondo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primario/40',
          !n.leida && 'bg-primario/4',
        )}
      >
        <span
          className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', clases)}
        >
          <Icono className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={cn('truncate text-sm', n.leida ? 'font-medium' : 'font-semibold')}>
              {n.titulo || etiqueta}
            </span>
            {!n.leida && <span className="size-2 shrink-0 rounded-full bg-primario" aria-hidden />}
          </span>
          <span className="sr-only">
            {etiqueta}. {n.leida ? 'Leída' : 'No leída'}.
          </span>
          {n.mensaje && <span className="block text-sm text-etiqueta">{n.mensaje}</span>}
          <span className="block pt-0.5 text-xs text-texto-suave">
            {fecha.format(new Date(n.fecha))}
          </span>
        </span>
      </button>
    </li>
  );
}
