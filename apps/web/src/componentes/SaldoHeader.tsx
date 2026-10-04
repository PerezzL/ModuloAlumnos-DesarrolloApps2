import { TriangleAlert, Wallet } from 'lucide-react';
import { Link } from 'react-router';
import { formatearMonto } from '@/core/monto';
import { useSaldo } from '@/core/saldo';

/**
 * Saldo en la barra superior. Si CORE no responde, lo dice: nunca muestra un saldo en cero
 * que no es real.
 */
export function SaldoHeader() {
  const { data, isPending, isError } = useSaldo();

  return (
    <Link
      to="/cuenta-corriente"
      className="flex h-9 items-center gap-2 rounded-item border border-borde-suave px-3 text-sm hover:bg-borde-suave focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primario/40"
    >
      {isError ? (
        <>
          <TriangleAlert className="size-4 text-aviso" aria-hidden />
          <span className="text-texto-suave">Saldo no disponible</span>
        </>
      ) : (
        <>
          <Wallet className="size-4 text-texto-suave" aria-hidden />
          <span className="sr-only">Saldo:</span>
          <span className="font-semibold tabular-nums" aria-busy={isPending}>
            {isPending ? '…' : formatearMonto(data.monto, data.moneda)}
          </span>
        </>
      )}
    </Link>
  );
}
