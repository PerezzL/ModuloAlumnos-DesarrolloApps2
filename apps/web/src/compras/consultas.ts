import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { PaginaCompras } from '@uadenet/api-types';
import { api } from '@/api/cliente';
import { datosDe } from '@/api/errores';

export const POR_PAGINA = 10;

/** Una página del historial de compras. Mientras carga la siguiente, se ve la anterior. */
export function useCompras(page: number) {
  return useQuery({
    queryKey: ['compras', { page }],
    queryFn: (): Promise<PaginaCompras> =>
      datosDe(api.GET('/compras', { params: { query: { page, limit: POR_PAGINA } } })),
    placeholderData: keepPreviousData,
  });
}

/** "COMPLETADA" → "Completada". El estado es el de la Tienda: no se interpreta. */
export const estadoLegible = (estado: string) =>
  estado.charAt(0).toUpperCase() + estado.slice(1).toLowerCase().replace(/_/g, ' ');
