import type { CorrelativaFaltante } from '@uadenet/api-types';
import { ErrorApi } from '@/api/errores';

/** Qué le falta al alumno según el tipo de correlativa */
export const QUE_FALTA = { APROBADA: 'aprobar', REGULAR: 'regularizar' } as const;

export interface Rechazo {
  titulo: string;
  mensaje: string;
  correlativasFaltantes: CorrelativaFaltante[];
}

const MENSAJES: Record<string, Omit<Rechazo, 'correlativasFaltantes'>> = {
  YA_INSCRIPTO: {
    titulo: 'Ya estás inscripto',
    mensaje: 'Ya tenés una inscripción en esta materia para este período.',
  },
  SIN_CUPO: {
    titulo: 'La comisión se quedó sin cupo',
    mensaje: 'Alguien ocupó el último lugar. Probá con otra comisión de la materia.',
  },
  CORRELATIVIDAD_FALTANTE: {
    titulo: 'Te faltan correlativas',
    mensaje: 'Para cursar esta materia primero tenés que cumplir estas correlativas:',
  },
  SIN_REGULARIDAD: {
    titulo: 'No cumplís la condición de regularidad',
    mensaje: 'Para inscribirte tenés que ser alumno regular. Consultá en Secretaría Académica.',
  },
  FUERA_DE_FECHA: {
    titulo: 'La inscripción está cerrada',
    mensaje: 'El período de inscripción terminó o todavía no empezó.',
  },
};

const GENERICO = {
  titulo: 'No pudimos inscribirte',
  mensaje: 'Gestión Académica rechazó la inscripción. Consultá en Secretaría Académica.',
};

/**
 * Un 409 de `POST /inscripciones` → mensaje para el alumno. Un `code` desconocido o
 * `INSCRIPCION_RECHAZADA` no rompe la pantalla: muestra el motivo que dio Gestión Académica
 * (`detail`) o, si no lo dio, un mensaje genérico. Hoy el Módulo 9 solo informa códigos
 * genéricos, así que es el caso habitual. Cualquier otro error no es un rechazo (null).
 */
export function describirRechazo(error: unknown): Rechazo | null {
  if (!(error instanceof ErrorApi) || error.status !== 409) return null;
  const problema = error.problema as typeof error.problema & {
    correlativasFaltantes?: CorrelativaFaltante[];
  };
  const base = Object.hasOwn(MENSAJES, problema.code)
    ? MENSAJES[problema.code]!
    : { ...GENERICO, ...(problema.detail && { mensaje: problema.detail }) };
  return {
    ...base,
    correlativasFaltantes:
      problema.code === 'CORRELATIVIDAD_FALTANTE' ? (problema.correlativasFaltantes ?? []) : [],
  };
}
