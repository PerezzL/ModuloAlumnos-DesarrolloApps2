import { ArrowLeft, SearchX } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { ErrorApi } from '@/api/errores';
import { estadoLegible, useCompra } from '@/compras/consultas';
import { Cargando } from '@/componentes/Cargando';
import { ErrorCarga } from '@/componentes/ErrorCarga';
import { EstadoVacio } from '@/componentes/EstadoVacio';
import { formatearMonto } from '@/core/monto';

const fecha = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'America/Argentina/Buenos_Aires',
});

const Volver = () => (
  <Link
    to="/compras"
    className="flex items-center gap-1 self-start text-sm font-semibold text-primario-oscuro hover:underline"
  >
    <ArrowLeft className="size-4" aria-hidden />
    Volver a mis compras
  </Link>
);

/** Detalle de una compra (4.10): productos con el precio que tenían al momento de comprar. */
export function CompraDetalle() {
  const { orderId = '' } = useParams();
  const { data, error, isPending, refetch } = useCompra(orderId);

  if (isPending) return <Cargando texto="Cargando la compra…" />;
  if (error instanceof ErrorApi && error.status === 404) {
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <Volver />
        <EstadoVacio
          icono={SearchX}
          titulo="No encontramos esa compra"
          mensaje="Puede que el enlace esté mal o que la compra no sea tuya."
          className="rounded-campo border border-borde-suave bg-white"
        />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <Volver />
        <ErrorCarga error={error} fuente="La Tienda" reintentar={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Volver />
      <section
        aria-labelledby="titulo-compra"
        className="rounded-campo border border-borde-suave bg-white p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-2 pb-4">
          <div>
            <h2 id="titulo-compra" className="text-lg font-semibold">
              Compra del {fecha.format(new Date(data.fecha))}
            </h2>
            {data.sede && <p className="text-sm text-texto-suave">Sede {data.sede}</p>}
          </div>
          <span className="rounded-full bg-fondo px-2.5 py-0.5 text-xs font-semibold text-etiqueta">
            {estadoLegible(data.estado)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <caption className="sr-only">Productos de la compra</caption>
            <thead className="border-b border-borde-suave text-xs uppercase tracking-wide text-texto-suave">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Producto
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">
                  Cantidad
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">
                  Precio unitario
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde-suave">
              {data.productos.map((p, i) => (
                <tr key={p.productoId ?? i}>
                  <td className="py-3 pr-4 font-medium">{p.nombre}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{p.cantidad}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatearMonto(p.precioUnitario)}
                  </td>
                  <td className="py-3 text-right tabular-nums">{formatearMonto(p.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="mt-4 flex flex-col items-end gap-1 border-t border-borde-suave pt-4 text-sm">
          <div className="flex gap-6">
            <dt className="text-texto-suave">Subtotal</dt>
            <dd className="w-32 text-right tabular-nums">{formatearMonto(data.subtotal)}</dd>
          </div>
          <div className="flex gap-6 text-base font-semibold">
            <dt>Total</dt>
            <dd className="w-32 text-right tabular-nums">{formatearMonto(data.total)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
