import { Wallet } from 'lucide-react';
import { Cargando } from '@/componentes/Cargando';
import { Movimientos } from '@/componentes/Movimientos';
import { ErrorCarga } from '@/componentes/ErrorCarga';
import { formatearMonto } from '@/core/monto';
import { useSaldo } from '@/core/saldo';

/** Saldo y carga de saldo (4.11). Todo contra CORE: el BFF no interviene. */
export function CuentaCorriente() {
  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="flex flex-col gap-6">
        <TarjetaSaldo />
      </div>
      <Movimientos />
    </div>
  );
}

function TarjetaSaldo() {
  const { data, error, isPending, refetch } = useSaldo();

  return (
    <section
      aria-labelledby="titulo-saldo"
      className="rounded-campo bg-linear-135 from-uade-navy to-primario-oscuro p-6 text-white"
    >
      <h2 id="titulo-saldo" className="flex items-center gap-2 text-sm font-medium text-white/70">
        <Wallet className="size-4" aria-hidden />
        Saldo disponible
      </h2>
      {isPending ? (
        <Cargando texto="Cargando saldo…" />
      ) : error ? (
        <ErrorCarga
          error={error}
          fuente="El saldo"
          reintentar={() => void refetch()}
          compacto
          className="mt-3 bg-white"
        />
      ) : (
        <p className="pt-2 text-3xl font-bold tabular-nums">
          {formatearMonto(data.monto, data.moneda)}
        </p>
      )}
    </section>
  );
}
