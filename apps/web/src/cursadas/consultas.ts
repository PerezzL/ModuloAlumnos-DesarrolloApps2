import { useQuery } from '@tanstack/react-query';
import type { CursadaResumen } from '@uadenet/api-types';
import { api } from '@/api/cliente';
import { datosDe } from '@/api/errores';

export const CLAVE_CURSADAS = ['cursadas'] as const;

/** Historial completo del alumno. Consulta en vivo: el portal no lo guarda. */
export function useCursadas() {
  return useQuery({
    queryKey: CLAVE_CURSADAS,
    queryFn: async (): Promise<CursadaResumen[]> => (await datosDe(api.GET('/cursadas'))).items,
  });
}
