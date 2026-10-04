import { useQuery } from '@tanstack/react-query';
import type { Perfil } from '@uadenet/api-types';
import { api } from './cliente';
import { datosDe } from './errores';

export function usePerfil() {
  return useQuery({
    queryKey: ['perfil'],
    queryFn: (): Promise<Perfil> => datosDe(api.GET('/me')),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
