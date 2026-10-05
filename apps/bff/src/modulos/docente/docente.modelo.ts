import type { NotaResumen } from '@uadenet/api-types';

/** Una nota del Módulo 2 con los datos del detalle (4.7). Lo arma el adaptador. */
export interface NotaConDocente extends NotaResumen {
  docente: string | null;
  observaciones: string | null;
}
