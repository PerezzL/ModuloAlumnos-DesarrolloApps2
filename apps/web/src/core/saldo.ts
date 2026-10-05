import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { pedirCore } from './http';

/**
 * Saldo de CORE (sección 7 de CORE_INTEGRACION.md). Único lugar del front que conoce la forma
 * de las respuestas de wallets, que es PROVISIONAL hasta tener el `contracts/openapi.yaml` de
 * CORE (docs/integraciones.md). El resto de la app usa `Saldo` y `Movimiento`.
 */

export interface Saldo {
  /** String decimal: nunca float */
  monto: string;
  moneda: string;
}

export interface Movimiento {
  id: string;
  fecha: string;
  concepto: string;
  tipo: 'INGRESO' | 'EGRESO';
  monto: string;
  moneda: string;
  pendiente: boolean;
}

/** Forma que suponemos de `GET /api/v1/wallets/me` */
interface WalletCore {
  balance: string;
  currency: string;
}

/** Forma que suponemos de un ítem de `GET /api/v1/wallets/me/transactions` */
export interface TransaccionCore {
  transactionId: string;
  status: string;
  type: string;
  concept: string;
  amount: string;
  currency: string;
  description?: string | null;
  createdAt: string;
}

const CONCEPTOS: Record<string, string> = {
  TOP_UP: 'Carga de saldo',
  STORE_PURCHASE: 'Compra en la tienda',
  DINING_RESERVATION: 'Reserva de comedor',
  LIBRARY_FINE: 'Multa de biblioteca',
  EVENT_REGISTRATION: 'Inscripción a evento',
  SCHOLARSHIP: 'Beca',
};

export function aMovimiento(t: TransaccionCore): Movimiento {
  return {
    id: t.transactionId,
    fecha: t.createdAt,
    concepto: t.description || CONCEPTOS[t.concept] || t.concept,
    // Una devolución (REVERSAL) le vuelve la plata al alumno
    tipo: t.type === 'DEBIT' ? 'EGRESO' : 'INGRESO',
    monto: t.amount,
    moneda: t.currency,
    pendiente: t.status === 'PENDING',
  };
}

export function useSaldo() {
  return useQuery({
    queryKey: ['saldo'],
    queryFn: async (): Promise<Saldo> => {
      const { datos } = await pedirCore<WalletCore>('/api/v1/wallets/me');
      return { monto: datos.balance, moneda: datos.currency };
    },
  });
}

const POR_PAGINA = 10;

/** Movimientos paginados con la paginación de CORE (`cursor` opaco y `limit`) */
export function useMovimientos() {
  return useInfiniteQuery({
    queryKey: ['movimientos'],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const query = new URLSearchParams({ limit: String(POR_PAGINA) });
      if (pageParam) query.set('cursor', pageParam);
      const { datos } = await pedirCore<{ items: TransaccionCore[]; nextCursor: string | null }>(
        `/api/v1/wallets/me/transactions?${query}`,
      );
      return { movimientos: datos.items.map(aMovimiento), siguiente: datos.nextCursor };
    },
    getNextPageParam: (pagina) => pagina.siguiente,
  });
}
