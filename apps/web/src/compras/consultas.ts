import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { CompraDetalle, ListaSedes, PaginaCompras } from '@uadenet/api-types';
import { api } from '@/api/cliente';
import { datosDe } from '@/api/errores';

export const POR_PAGINA = 10;

/**
 * Estados de la Tienda con su etiqueta. Se muestran tal cual, sin otra interpretación; un
 * estado que no esté acá se muestra con su nombre original.
 */
export const ESTADOS: Record<string, string> = {
  PENDING_PAYMENT: 'Pago pendiente',
  COMPLETED: 'Completada',
  COMPENSATING: 'En reversión',
  FAILED: 'Fallida',
};

export interface FiltrosCompras {
  desde?: string;
  hasta?: string;
  estado?: string;
  /** `id` de una sede de `GET /sedes` */
  sede?: string;
}

/**
 * Catálogo de sedes para el filtro. Casi no cambia: se pide una vez por sesión. Si falla, el
 * filtro queda sin opciones y el listado funciona igual.
 */
export function useSedes() {
  return useQuery({
    queryKey: ['sedes'],
    queryFn: (): Promise<ListaSedes> => datosDe(api.GET('/sedes')),
    staleTime: Infinity,
    retry: false,
  });
}

/**
 * Historial de compras con la paginación por cursor de la Tienda: cada "ver más" agrega la
 * página siguiente. Al cambiar un filtro arranca de cero; mientras carga, se ve lo anterior.
 */
export function useCompras(filtros: FiltrosCompras, habilitada = true) {
  return useInfiniteQuery({
    queryKey: ['compras', filtros],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }): Promise<PaginaCompras> =>
      datosDe(
        api.GET('/compras', {
          params: { query: { limit: POR_PAGINA, ...filtros, cursor: pageParam } },
        }),
      ),
    getNextPageParam: (pagina) => pagina.nextCursor ?? undefined,
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

/** "COMPLETED" → "Completada"; un estado desconocido, tal como llega */
export const estadoLegible = (estado: string) => ESTADOS[estado] ?? estado;
