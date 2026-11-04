import type { NotaResumen } from '@uadenet/api-types';

/** Una nota del Módulo 2 con el id del docente que la cargó (para buscar su nombre). */
export interface NotaConDocente extends NotaResumen {
  docenteId: string | null;
}

/** Las notas del alumno en un curso y su promedio, si el Módulo 2 lo informa. */
export interface NotasCurso {
  notas: NotaConDocente[];
  promedio: number | null;
}
