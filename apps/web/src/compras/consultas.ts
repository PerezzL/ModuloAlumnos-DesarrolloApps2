import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { CompraDetalle, PaginaCompras } from '@uadenet/api-types';
import { api } from '@/api/cliente';
import { datosDe } from '@/api/errores';

export const POR_PAGINA = 10;

/**
 * Estados que conocemos de la Tienda (los de su fixture). Provisional: la Tienda no publicó la
 * lista; un estado que no esté acá se muestra igual en el listado.
 */
export const ESTADOS_CONOCIDOS = ['COMPLETADA', 'CANCELADA'];

export interface FiltrosCompras {
  desde?: string;
  hasta?: string;
  estado?: string;
}

/** Una página del historial de compras. Mientras carga la siguiente, se ve la anterior. */
export function useCompras(page: number, filtros: FiltrosCompras, habilitada = true) {
  return useQuery({
    queryKey: ['compras', { page, ...filtros }],
    queryFn: (): Promise<PaginaCompras> =>
      datosDe(api.GET('/compras', { params: { query: { page, limit: POR_PAGINA, ...filtros } } })),
    placeholderData: keepPreviousData,
    enabled: habilitada,
  });
}

/** Detalle de una compra propia. Un 404 (inexistente o ajena) no se reintenta. */
export function useCompra(orderId: string) {
  return useQuery({
    queryKey: ['compras', 'detalle', orderId],
    queryFn: (): Promise<CompraDetalle> =>
      datosDe(api.GET('/compras/{orderId}', { params: { path: { orderId } } })),
  });
}

/** "COMPLETADA" → "Completada". El estado es el de la Tienda: no se interpreta. */
export const estadoLegible = (estado: string) =>
  estado.charAt(0).toUpperCase() + estado.slice(1).toLowerCase().replace(/_/g, ' ');
