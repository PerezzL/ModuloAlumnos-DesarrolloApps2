import { ArrowDownLeft, ArrowUpRight, Receipt } from 'lucide-react';
import { Cargando } from '@/componentes/Cargando';
import { ErrorCarga } from '@/componentes/ErrorCarga';
import { EstadoVacio } from '@/componentes/EstadoVacio';
import { Button } from '@/componentes/ui/button';
import { formatearMonto } from '@/core/monto';
import { useMovimientos } from '@/core/saldo';
import { cn } from '@/lib/utils';

const fecha = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Argentina/Buenos_Aires',
});

/** Historial de movimientos del saldo, paginado con el cursor de CORE. */
export function Movimientos() {
  const { data, error, isPending, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useMovimientos();
  const movimientos = data?.pages.flatMap((p) => p.movimientos) ?? [];

  return (
    <section
      aria-labelledby="titulo-movimientos"
      className="rounded-campo border border-borde-suave bg-white p-6"
    >
      <h2 id="titulo-movimientos" className="pb-4 font-semibold">
        Movimientos
      </h2>
      {isPending ? (
        <Cargando texto="Cargando movimientos…" />
      ) : error && movimientos.length === 0 ? (
        <ErrorCarga
          error={error}
          fuente="El historial de movimientos"
          reintentar={() => void refetch()}
        />
      ) : movimientos.length === 0 ? (
        <EstadoVacio
          icono={Receipt}
          titulo="Todavía no tenés movimientos"
          mensaje="Cuando cargues saldo o pagues en el comedor, la tienda o un evento, lo vas a ver acá."
        />
      ) : (
        <>
          <ul className="divide-y divide-borde-suave">
            {movimientos.map((m) => {
              const ingreso = m.tipo === 'INGRESO';
              const Icono = ingreso ? ArrowDownLeft : ArrowUpRight;
              return (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-full',
                      ingreso ? 'bg-exito-fondo text-exito' : 'bg-fondo text-etiqueta',
                    )}
                  >
                    <Icono className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.concepto}</p>
                    <p className="text-xs text-texto-suave">
                      {fecha.format(new Date(m.fecha))}
                      {m.pendiente && ' · Pendiente'}
                    </p>
                  </div>
                  <p
                    className={cn(
                      'text-sm font-semibold tabular-nums',
                      ingreso ? 'text-exito' : 'text-texto',
                    )}
                  >
                    <span className="sr-only">{ingreso ? 'Ingreso' : 'Egreso'}: </span>
                    {ingreso ? '+' : '−'}
                    {formatearMonto(m.monto, m.moneda)}
                  </p>
                </li>
              );
            })}
          </ul>
          {error && (
            <ErrorCarga
              error={error}
              fuente="El historial de movimientos"
              compacto
              className="mt-3"
            />
          )}
          {hasNextPage && (
            <Button
              variant="fantasma"
              className="mt-3 w-full"
              disabled={isFetchingNextPage}
              onClick={() => void fetchNextPage()}
            >
              {isFetchingNextPage ? 'Cargando…' : 'Ver más movimientos'}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
