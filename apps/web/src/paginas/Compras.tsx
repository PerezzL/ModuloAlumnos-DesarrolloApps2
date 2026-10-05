import type { CompraResumen } from '@uadenet/api-types';
import { ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { estadoLegible, useCompras } from '@/compras/consultas';
import { Cargando } from '@/componentes/Cargando';
import { ErrorCarga } from '@/componentes/ErrorCarga';
import { EstadoVacio } from '@/componentes/EstadoVacio';
import { Button } from '@/componentes/ui/button';
import { formatearMonto } from '@/core/monto';

const fecha = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Argentina/Buenos_Aires',
});

function paginaDeUrl(valor: string | null) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/** Historial de compras en la Tienda (4.10). Solo lectura; la página va en la URL. */
export function Compras() {
  const [params, setParams] = useSearchParams();
  const page = paginaDeUrl(params.get('pagina'));
  const { data, error, isPending, isPlaceholderData, refetch } = useCompras(page);

  const irA = (nueva: number) =>
    setParams((actual) => {
      const nuevos = new URLSearchParams(actual);
      if (nueva > 1) nuevos.set('pagina', String(nueva));
      else nuevos.delete('pagina');
      return nuevos;
    });

  return (
    <section
      aria-labelledby="titulo-compras"
      className="flex max-w-5xl flex-col gap-4 rounded-campo border border-borde-suave bg-white p-6"
    >
      <h2 id="titulo-compras" className="text-lg font-semibold">
        Mis compras
      </h2>
      {isPending ? (
        <Cargando texto="Cargando tus compras…" />
      ) : error ? (
        <ErrorCarga error={error} fuente="La Tienda" reintentar={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EstadoVacio
          icono={ShoppingBag}
          titulo="Todavía no hiciste compras"
          mensaje="Cuando compres en la Tienda del campus, vas a ver tus compras acá."
        />
      ) : (
        <>
          <ul
            aria-label="Compras"
            className="divide-y divide-borde-suave"
            aria-busy={isPlaceholderData}
          >
            {data.items.map((c) => (
              <FilaCompra key={c.orderId} compra={c} />
            ))}
          </ul>
          <Paginacion
            page={data.page}
            paginas={Math.max(1, Math.ceil(data.total / data.limit))}
            total={data.total}
            cargando={isPlaceholderData}
            irA={irA}
          />
        </>
      )}
    </section>
  );
}

function FilaCompra({ compra }: { compra: CompraResumen }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{fecha.format(new Date(compra.fecha))}</p>
        <p className="text-sm text-texto-suave">
          {[
            compra.sede && `Sede ${compra.sede}`,
            compra.cantidadProductos !== undefined &&
              `${compra.cantidadProductos} ${compra.cantidadProductos === 1 ? 'producto' : 'productos'}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <span className="rounded-full bg-fondo px-2.5 py-0.5 text-xs font-semibold text-etiqueta">
        {estadoLegible(compra.estado)}
      </span>
      <p className="w-28 text-right font-semibold tabular-nums">{formatearMonto(compra.total)}</p>
    </li>
  );
}

function Paginacion({
  page,
  paginas,
  total,
  cargando,
  irA,
}: {
  page: number;
  paginas: number;
  total: number;
  cargando: boolean;
  irA: (page: number) => void;
}) {
  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-2 pt-2">
      <p className="text-sm text-texto-suave">
        {total} {total === 1 ? 'compra' : 'compras'} · Página {page} de {paginas}
      </p>
      <div className="flex gap-1">
        <Button
          variant="fantasma"
          size="icono"
          aria-label="Página anterior"
          disabled={page <= 1 || cargando}
          onClick={() => irA(page - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <Button
          variant="fantasma"
          size="icono"
          aria-label="Página siguiente"
          disabled={page >= paginas || cargando}
          onClick={() => irA(page + 1)}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
