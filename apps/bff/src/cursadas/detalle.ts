import type { CursadaDetalle } from '@uadenet/api-types';
import type { InscripcionAlumno } from '../modulos/academico/academico.modelo';
import { aCursadaResumen, masRecientesPrimero } from './historial';

/**
 * La inscripción del alumno en el curso, o undefined si no cursa ahí. Si hay más de una (por
 * ejemplo, una baja y una nueva), vale la más reciente.
 */
export const inscripcionDelCurso = (inscripciones: InscripcionAlumno[], cursoId: string) =>
  masRecientesPrimero(inscripciones).find((i) => i.cursoId === cursoId);

/** Encabezado del detalle: la situación y la comisión, tal como las informa el Módulo 9. */
export const aCursadaDetalle = (i: InscripcionAlumno): CursadaDetalle => ({
  ...aCursadaResumen(i),
  ...(i.comision !== undefined && { comision: i.comision }),
});
