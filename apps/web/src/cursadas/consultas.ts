import { useQuery } from '@tanstack/react-query';
import type {
  CursadaDetalle,
  CursadaResumen,
  ModuloExterno,
  NotaDetalle,
} from '@uadenet/api-types';
import { api } from '@/api/cliente';
import { datosDe } from '@/api/errores';

export const CLAVE_CURSADAS = ['cursadas'] as const;

export interface Historial {
  items: CursadaResumen[];
  /** Si incluye DOCENTE, las notas finales no cargaron */
  fuentesConError: ModuloExterno[];
}

/** Historial completo del alumno. Consulta en vivo: el portal no lo guarda. */
export function useCursadas() {
  return useQuery({
    queryKey: CLAVE_CURSADAS,
    queryFn: (): Promise<Historial> => datosDe(api.GET('/cursadas')),
  });
}

/** Detalle de una cursada propia. Un 404 (no inscripto en ese curso) no se reintenta. */
export function useCursada(cursoId: string) {
  return useQuery({
    queryKey: [...CLAVE_CURSADAS, 'detalle', cursoId],
    queryFn: (): Promise<CursadaDetalle> =>
      datosDe(api.GET('/cursadas/{cursoId}', { params: { path: { cursoId } } })),
  });
}

/** Detalle de una nota propia (4.7). Un 404 (inexistente o ajena) no se reintenta. */
export function useNota(cursoId: string, notaId: string) {
  return useQuery({
    queryKey: [...CLAVE_CURSADAS, 'detalle', cursoId, 'notas', notaId],
    queryFn: (): Promise<NotaDetalle> =>
      datosDe(
        api.GET('/cursadas/{cursoId}/notas/{notaId}', { params: { path: { cursoId, notaId } } }),
      ),
  });
}
