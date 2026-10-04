import { useQuery } from '@tanstack/react-query';
import type { Calendario, CategoriaCalendario } from '@uadenet/api-types';
import { api } from '@/api/cliente';
import { datosDe } from '@/api/errores';

/** `GET /calendario` del rango visible. Sin categorías elegidas no se pide nada. */
export function useCalendario(
  rango: { desde: string; hasta: string },
  categorias?: CategoriaCalendario[],
) {
  const todas = !categorias || categorias.length === 3;
  return useQuery({
    queryKey: [
      'calendario',
      rango.desde,
      rango.hasta,
      todas ? 'todas' : [...categorias].sort().join(),
    ],
    queryFn: (): Promise<Calendario> =>
      datosDe(
        api.GET('/calendario', {
          params: { query: { ...rango, ...(!todas && { categorias }) } },
        }),
      ),
    enabled: categorias === undefined || categorias.length > 0,
  });
}
