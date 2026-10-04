import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Inscripcion, OfertaInscripcion } from '@uadenet/api-types';
import { api } from '@/api/cliente';
import { datosDe } from '@/api/errores';

export const CLAVE_OFERTA = ['inscripcion', 'oferta'] as const;
export const CLAVE_CURSADAS = ['cursadas'] as const;

/** Oferta del período vigente. Siempre en vivo: el cupo cambia mientras el alumno mira. */
export function useOferta() {
  return useQuery({
    queryKey: CLAVE_OFERTA,
    queryFn: (): Promise<OfertaInscripcion> => datosDe(api.GET('/inscripcion/oferta')),
  });
}

/** La comisión pasa a INSCRIPTO y suma un inscripto, sin esperar a recargar la oferta. */
export function marcarInscripto(oferta: OfertaInscripcion, cursoId: string): OfertaInscripcion {
  return {
    ...oferta,
    materias: oferta.materias.map((m) => ({
      ...m,
      comisiones: m.comisiones.map((c) =>
        c.cursoId === cursoId
          ? {
              ...c,
              estado: 'INSCRIPTO' as const,
              ...(c.inscriptosActivos !== undefined && {
                inscriptosActivos: c.inscriptosActivos + 1,
              }),
            }
          : c,
      ),
    })),
  };
}

/**
 * `POST /inscripciones`. Es una escritura: no se reintenta sola (TanStack deja las mutaciones
 * en 0). Si falla, se vuelve a pedir la oferta, porque el cupo o el estado pudieron cambiar.
 */
export function useInscribir() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cursoId: string): Promise<Inscripcion> =>
      datosDe(api.POST('/inscripciones', { body: { cursoId } })),
    onSuccess: (_inscripcion, cursoId) => {
      queryClient.setQueryData<OfertaInscripcion>(
        CLAVE_OFERTA,
        (oferta) => oferta && marcarInscripto(oferta, cursoId),
      );
      void queryClient.invalidateQueries({ queryKey: CLAVE_CURSADAS });
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: CLAVE_OFERTA }),
  });
}
