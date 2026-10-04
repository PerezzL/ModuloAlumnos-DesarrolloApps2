import { useQuery } from '@tanstack/react-query';
import type { Perfil } from '@uadenet/api-types';
import { api } from './cliente';

export function usePerfil() {
  return useQuery({
    queryKey: ['perfil'],
    queryFn: async (): Promise<Perfil> => {
      const { data, error } = await api.GET('/me');
      if (error || !data) throw error ?? new Error('Sin datos');
      return data;
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}
