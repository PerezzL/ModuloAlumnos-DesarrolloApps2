import { BellOff, CheckCheck } from 'lucide-react';
import { useAvisar } from '@/componentes/Avisos';
import { Cargando } from '@/componentes/Cargando';
import { ErrorCarga } from '@/componentes/ErrorCarga';
import { EstadoVacio } from '@/componentes/EstadoVacio';
import { Button } from '@/componentes/ui/button';
import { useMarcarTodas, useNoLeidas, useNotificaciones } from '@/core/notificaciones';
import { ItemNotificacion } from './ItemNotificacion';
import { useAbrirNotificacion } from './useAbrirNotificacion';

/**
 * Listado de notificaciones, de la más nueva a la más vieja. Lo usan el panel de la campana
 * (primera página) y la pantalla de notificaciones (con "ver más").
 */
export function ListaNotificaciones({
  paginar = false,
  alNavegar,
}: {
  paginar?: boolean;
  alNavegar?: () => void;
}) {
  const { data, error, isPending, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useNotificaciones();
  const { data: noLeidas } = useNoLeidas();
  const marcarTodas = useMarcarTodas();
  const avisar = useAvisar();
  const { abrir, dialogo } = useAbrirNotificacion(alNavegar);
  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const hayNoLeidas = (noLeidas ?? 0) > 0 || items.some((n) => !n.leida);

  if (isPending) return <Cargando texto="Cargando notificaciones…" />;
  if (error && items.length === 0) {
    return (
      <ErrorCarga error={error} fuente="Las notificaciones" reintentar={() => void refetch()} />
    );
  }
  if (items.length === 0) {
    return (
      <EstadoVacio
        icono={BellOff}
        titulo="No tenés notificaciones"
        mensaje="Te avisamos acá cuando se publique una nota, tengas una sanción de biblioteca o se acerque un evento."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {hayNoLeidas && (
        <Button
          variant="fantasma"
          className="self-end"
          disabled={marcarTodas.isPending}
          onClick={() =>
            marcarTodas.mutate(undefined, {
              onError: () =>
                avisar({
                  tono: 'error',
                  titulo: 'No pudimos marcar las notificaciones como leídas',
                  mensaje: 'Probá de nuevo en unos minutos.',
                }),
            })
          }
        >
          <CheckCheck className="size-4" aria-hidden />
          Marcar todas como leídas
        </Button>
      )}
      <ul className="flex flex-col gap-1">
        {items.map((n) => (
          <ItemNotificacion key={n.id} notificacion={n} abrir={abrir} />
        ))}
      </ul>
      {paginar && hasNextPage && (
        <Button
          variant="fantasma"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {isFetchingNextPage ? 'Cargando…' : 'Ver más notificaciones'}
        </Button>
      )}
      {dialogo}
    </div>
  );
}
