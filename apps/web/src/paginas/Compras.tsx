import type { CompraResumen } from '@uadenet/api-types';
import { SearchX, ShoppingBag } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import {
  ESTADOS,
  estadoLegible,
  type FiltrosCompras,
  useCompras,
  useSedes,
} from '@/compras/consultas';
import { Cargando } from '@/componentes/Cargando';
import { ErrorCarga } from '@/componentes/ErrorCarga';
import { EstadoVacio } from '@/componentes/EstadoVacio';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { formatearMonto } from '@/core/monto';

const fecha = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Argentina/Buenos_Aires',
});

const esFecha = (valor: string | null): valor is string =>
  valor !== null && /^\d{4}-\d{2}-\d{2}$/.test(valor);

function filtrosDeUrl(params: URLSearchParams): FiltrosCompras {
  const desde = params.get('desde');
  const hasta = params.get('hasta');
  const estado = params.get('estado');
  const sede = params.get('sede');
  return {
    ...(esFecha(desde) && { desde }),
    ...(esFecha(hasta) && { hasta }),
    ...(estado && { estado }),
    ...(sede && { sede }),
  };
}

/**
 * Historial de compras en la Tienda (4.10). Solo lectura. Los filtros van en la URL; la
 * paginación es por cursor ("ver más") y al cambiar un filtro arranca de cero. Las sedes salen
 * del catálogo de Backoffice; que la Tienda filtre por ese id es suposición nuestra
 * (docs/integraciones.md).
 */
export function Compras() {
  const [params, setParams] = useSearchParams();
  const filtros = filtrosDeUrl(params);
  const hayFiltros = Object.keys(filtros).length > 0;
  // YYYY-MM-DD se compara bien como texto
  const rangoInvalido = !!filtros.desde && !!filtros.hasta && filtros.hasta < filtros.desde;
  const {
    data,
    error,
    isPending,
    isPlaceholderData,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useCompras(filtros, !rangoInvalido);
  const compras = data?.pages.flatMap((p) => p.items) ?? [];

  const filtrar = (cambio: Partial<Record<keyof FiltrosCompras, string>>) =>
    setParams((actual) => {
      const nuevos = new URLSearchParams(actual);
      for (const [clave, valor] of Object.entries(cambio)) {
        if (valor) nuevos.set(clave, valor);
        else nuevos.delete(clave);
      }
      return nuevos;
    });
  const limpiar = () => setParams(new URLSearchParams());

  return (
    <section
      aria-labelledby="titulo-compras"
      className="flex max-w-5xl flex-col gap-4 rounded-campo border border-borde-suave bg-white p-6"
    >
      <h2 id="titulo-compras" className="text-lg font-semibold">
        Mis compras
      </h2>
      <Filtros filtros={filtros} filtrar={filtrar} />
      {rangoInvalido ? (
        <p role="alert" className="text-sm text-peligro-texto">
          La fecha “hasta” no puede ser anterior a “desde”.
        </p>
      ) : isPending ? (
        <Cargando texto="Cargando tus compras…" />
      ) : error ? (
        <ErrorCarga error={error} fuente="La Tienda" reintentar={() => void refetch()} />
      ) : compras.length === 0 && hayFiltros ? (
        <EstadoVacio
          icono={SearchX}
          titulo="No hay compras con estos filtros"
          mensaje="Probá con otras fechas, otro estado u otra sede."
        >
          <Button variant="fantasma" onClick={limpiar}>
            Limpiar filtros
          </Button>
        </EstadoVacio>
      ) : compras.length === 0 ? (
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
            {compras.map((c) => (
              <FilaCompra key={c.orderId} compra={c} />
            ))}
          </ul>
          {hasNextPage && (
            <Button
              variant="fantasma"
              className="w-full"
              disabled={isFetchingNextPage || isPlaceholderData}
              onClick={() => void fetchNextPage()}
            >
              {isFetchingNextPage ? 'Cargando…' : 'Ver más compras'}
            </Button>
          )}
        </>
      )}
    </section>
  );
}

function Filtros({
  filtros,
  filtrar,
}: {
  filtros: FiltrosCompras;
  filtrar: (cambio: Partial<Record<keyof FiltrosCompras, string>>) => void;
}) {
  const sedes = useSedes().data?.items ?? [];
  // Una sede de la URL que no está en el catálogo (o si no cargó) se conserva como opción
  const sedeDesconocida = !!filtros.sede && !sedes.some((s) => s.id === filtros.sede);
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <legend className="sr-only">Filtros</legend>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filtro-desde">Desde</Label>
        <Input
          id="filtro-desde"
          type="date"
          value={filtros.desde ?? ''}
          max={filtros.hasta}
          onChange={(e) => filtrar({ desde: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filtro-hasta">Hasta</Label>
        <Input
          id="filtro-hasta"
          type="date"
          value={filtros.hasta ?? ''}
          min={filtros.desde}
          onChange={(e) => filtrar({ hasta: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filtro-estado">Estado</Label>
        <select
          id="filtro-estado"
          value={filtros.estado ?? ''}
          onChange={(e) => filtrar({ estado: e.target.value })}
          className="h-10 rounded-item border border-borde bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primario/40"
        >
          <option value="">Todos</option>
          {/* Un estado de la URL que no conocemos se conserva como opción */}
          {[...new Set([...Object.keys(ESTADOS), ...(filtros.estado ? [filtros.estado] : [])])].map(
            (e) => (
              <option key={e} value={e}>
                {estadoLegible(e)}
              </option>
            ),
          )}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filtro-sede">Sede</Label>
        <select
          id="filtro-sede"
          value={filtros.sede ?? ''}
          onChange={(e) => filtrar({ sede: e.target.value })}
          className="h-10 rounded-item border border-borde bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primario/40"
        >
          <option value="">Todas</option>
          {sedes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
          {sedeDesconocida && <option value={filtros.sede}>Otra sede</option>}
        </select>
      </div>
    </fieldset>
  );
}

function FilaCompra({ compra }: { compra: CompraResumen }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
      <div className="min-w-0 flex-1">
        <Link
          to={`/compras/${encodeURIComponent(compra.orderId)}`}
          className="font-medium text-primario-oscuro hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primario/40"
        >
          Compra del {fecha.format(new Date(compra.fecha))}
        </Link>
        <p className="text-sm text-texto-suave">
          {[
            compra.sede,
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
