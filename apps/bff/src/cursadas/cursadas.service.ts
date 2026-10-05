import { Injectable, Logger } from '@nestjs/common';
import type { CursadaDetalle, ModuloExterno, NotaDetalle } from '@uadenet/api-types';
import { ProblemaError } from '../comun/problema';
import { AcademicoAdapter } from '../modulos/academico/academico.adapter';
import { DocenteAdapter, notaNoEncontrada } from '../modulos/docente/docente.adapter';
import { aCursadaDetalle, inscripcionDelCurso } from './detalle';

/**
 * Detalle de cursada (RF3, pantalla 4.5) y de una nota (RF4, pantalla 4.7). La situación,
 * la materia y la comisión salen del Módulo 9; la asistencia y las notas, del Módulo 2. Las llamadas van en paralelo; el portal no guarda nada.
 */
@Injectable()
export class CursadasService {
  private readonly logger = new Logger(CursadasService.name);

  constructor(
    private readonly academico: AcademicoAdapter,
    private readonly docente: DocenteAdapter,
  ) {}

  /**
   * Sin el Módulo 9 no hay detalle: su falla es la de toda la respuesta. Si falla el Módulo 2
   * (caído, timeout, respuesta inválida o un 404 que contradice al Módulo 9), la cursada sale
   * igual con lo que no cargó en null y `DOCENTE` en `fuentesConError`. Asistencia y notas
   * son llamadas distintas: si falla una sola, solo esa queda en null.
   */
  async detalle(alumnoId: string, cursoId: string): Promise<CursadaDetalle> {
    const [inscripciones, asistencia, notas] = await Promise.allSettled([
      this.academico.inscripciones(alumnoId),
      this.docente.asistencia(alumnoId, cursoId),
      this.docente.notas(alumnoId, cursoId),
    ]);
    if (inscripciones.status === 'rejected') throw inscripciones.reason;
    // Primero el Módulo 9: si no cursa ahí es 404, responda lo que responda el Módulo 2
    const inscripcion = inscripcionDelCurso(inscripciones.value, cursoId);
    if (!inscripcion) throw cursadaNoEncontrada();

    const fuentesConError = new Set<ModuloExterno>();
    const delDocente = <T>(resultado: PromiseSettledResult<T>, parte: string): T | null => {
      if (resultado.status === 'fulfilled') return resultado.value;
      const code = resultado.reason instanceof ProblemaError ? resultado.reason.code : undefined;
      this.logger.warn({ err: resultado.reason, parte, code }, 'Falló el Módulo 2 en la cursada');
      fuentesConError.add('DOCENTE');
      return null;
    };

    return {
      ...aCursadaDetalle(inscripcion),
      asistencia: delDocente(asistencia, 'asistencia'),
      notas: delDocente(notas, 'notas'),
      fuentesConError: [...fuentesConError],
    };
  }

  /**
   * Detalle de una nota. Acá el Módulo 2 es la fuente principal: si falla, falla la pantalla.
   * El Módulo 9 aporta materia y comisión y confirma que el curso es del alumno; si no lo es,
   * es 404 aunque el Módulo 2 tenga la nota.
   */
  async nota(alumnoId: string, cursoId: string, notaId: string): Promise<NotaDetalle> {
    const [inscripciones, nota] = await Promise.allSettled([
      this.academico.inscripciones(alumnoId),
      this.docente.nota(alumnoId, cursoId, notaId),
    ]);
    if (inscripciones.status === 'rejected') throw inscripciones.reason;
    const inscripcion = inscripcionDelCurso(inscripciones.value, cursoId);
    if (!inscripcion) throw notaNoEncontrada();
    if (nota.status === 'rejected') throw nota.reason;
    return {
      ...nota.value,
      cursoId: inscripcion.cursoId,
      asignatura: inscripcion.asignatura,
      ...(inscripcion.comision !== undefined && { comision: inscripcion.comision }),
    };
  }
}

const cursadaNoEncontrada = () =>
  new ProblemaError(404, 'CURSADA_NO_ENCONTRADA', 'La cursada no existe', {
    modulo: 'GESTION_ACADEMICA',
  });
