import { useQuery } from '@tanstack/react-query';
import type { OfertaInscripcion } from '@uadenet/api-types';
import { api } from '@/api/cliente';
import { datosDe } from '@/api/errores';

export const CLAVE_OFERTA = ['inscripcion', 'oferta'] as const;

/** Oferta del período vigente. Siempre en vivo: el cupo cambia mientras el alumno mira. */
export function useOferta() {
  return useQuery({
    queryKey: CLAVE_OFERTA,
    queryFn: (): Promise<OfertaInscripcion> => datosDe(api.GET('/inscripcion/oferta')),
  });
}
