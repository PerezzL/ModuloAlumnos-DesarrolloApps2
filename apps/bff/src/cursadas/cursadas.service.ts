import { Injectable } from '@nestjs/common';
import type { CursadaDetalle } from '@uadenet/api-types';
import { ProblemaError } from '../comun/problema';
import { AcademicoAdapter } from '../modulos/academico/academico.adapter';
import { DocenteAdapter } from '../modulos/docente/docente.adapter';
import { aCursadaDetalle, inscripcionDelCurso } from './detalle';

/**
 * Detalle de cursada (RF3, pantalla 4.5): la situación sale del Módulo 9 y la asistencia del
 * Módulo 2. Las llamadas van en paralelo; el portal no guarda nada.
 */
@Injectable()
export class CursadasService {
  constructor(
    private readonly academico: AcademicoAdapter,
    private readonly docente: DocenteAdapter,
  ) {}

  async detalle(alumnoId: string, cursoId: string): Promise<CursadaDetalle> {
    const [inscripciones, asistencia] = await Promise.allSettled([
      this.academico.inscripciones(alumnoId),
      this.docente.asistencia(alumnoId, cursoId),
    ]);
    // Primero el Módulo 9: si no cursa ahí es 404, responda lo que responda el Módulo 2
    const inscripcion = inscripcionDelCurso(valor(inscripciones), cursoId);
    if (!inscripcion) throw cursadaNoEncontrada();
    return { ...aCursadaDetalle(inscripcion), asistencia: valor(asistencia) };
  }
}

const valor = <T>(resultado: PromiseSettledResult<T>): T => {
  if (resultado.status === 'rejected') throw resultado.reason;
  return resultado.value;
};

const cursadaNoEncontrada = () =>
  new ProblemaError(404, 'CURSADA_NO_ENCONTRADA', 'La cursada no existe', {
    modulo: 'GESTION_ACADEMICA',
  });
