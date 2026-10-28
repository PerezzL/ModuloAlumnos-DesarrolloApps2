import type { Perfil } from '@uadenet/api-types';

/**
 * Lo que el portal necesita de Backoffice. `perfil` no trae `carrera`: Backoffice solo da el
 * id y el nombre sale del Módulo 9. El resto del BFF trabaja con este tipo, nunca con la
 * respuesta del módulo.
 */
export interface FichaAlumno {
  perfil: Omit<Perfil, 'carrera'>;
  carreraId: string | null;
}
