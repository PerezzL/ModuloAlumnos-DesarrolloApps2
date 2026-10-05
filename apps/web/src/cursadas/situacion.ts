import type { EstadoCursada } from '@uadenet/api-types';

/** Situación de la cursada tal como la informa el Módulo 9 */
export const SITUACION: Record<EstadoCursada, string> = {
  INSCRIPTO: 'Inscripto',
  CURSANDO: 'Cursando',
  BAJA: 'Baja',
  REGULAR: 'Regular',
  LIBRE: 'Libre',
  APROBADO: 'Aprobado',
  DESAPROBADO: 'Desaprobado',
};
