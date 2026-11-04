import { Injectable, Logger } from '@nestjs/common';
import type {
  CursadaDetalle,
  CursadaResumen,
  ModuloExterno,
  NotaDetalle,
} from '@uadenet/api-types';
import { ProblemaError } from '../comun/problema';
import { AcademicoAdapter } from '../modulos/academico/academico.adapter';
import { BackofficeAdapter } from '../modulos/backoffice/backoffice.adapter';
import { DocenteAdapter, notaNoEncontrada } from '../modulos/docente/docente.adapter';
import type { NotaConDocente } from '../modulos/docente/docente.modelo';
import { aCursadaDetalle, inscripcionDelCurso } from './detalle';
import { aHistorial } from './historial';

export interface Historial {
  items: CursadaResumen[];
  fuentesConError: ModuloExterno[];
}

/** Una nota sin el id del docente: así va en el listado */
const aNotaResumen = ({ docenteId: _d, ...nota }: NotaConDocente) => nota;

/**
 * Historial (RF3, 4.4), detalle de cursada (RF3, 4.5) y de una nota (RF4, 4.7). La situación,
 * la materia y la comisión salen del Módulo 9; asistencia, notas y nota final, del Módulo 2;
 * el nombre del docente, de Backoffice. Las llamadas van en paralelo; el portal no guarda nada.
 */
@Injectable()
export class CursadasService {
  private readonly logger = new Logger(CursadasService.name);

  constructor(
    private readonly academico: AcademicoAdapter,
    private readonly docente: DocenteAdapter,
    private readonly backoffice: BackofficeAdapter,
  ) {}

  /**
   * Sin el Módulo 9 no hay historial. Si fallan las notas finales del Módulo 2, el historial
   * sale igual con `notaFinal` en null y `DOCENTE` en `fuentesConError`.
   */
  async historial(alumnoId: string, periodoId?: string): Promise<Historial> {
    const [inscripciones, finales] = await Promise.allSettled([
      this.academico.inscripciones(alumnoId, periodoId),
      this.docente.notasFinales(alumnoId),
    ]);
    if (inscripciones.status === 'rejected') throw inscripciones.reason;
    const fuentes = new FuentesConError(this.logger);
    const notasFinales = fuentes.de(finales, 'notas finales');
    return {
      items: aHistorial(inscripciones.value, notasFinales),
      fuentesConError: fuentes.lista(),
    };
  }

  /**
   * Sin el Módulo 9 no hay detalle: su falla es la de toda la respuesta. Si falla el Módulo 2
   * (caído, timeout, respuesta inválida o un 404 que contradice al Módulo 9), la cursada sale
   * igual con lo que no cargó en null y `DOCENTE` en `fuentesConError`. Asistencia, notas y
   * nota final son llamadas distintas: si falla una sola, solo esa queda en null.
   */
  async detalle(alumnoId: string, cursoId: string): Promise<CursadaDetalle> {
    const [inscripciones, asistencia, notas, finales] = await Promise.allSettled([
      this.academico.inscripciones(alumnoId),
      this.docente.asistencia(alumnoId, cursoId),
      this.docente.notas(alumnoId, cursoId),
      this.docente.notasFinales(alumnoId, cursoId),
    ]);
    if (inscripciones.status === 'rejected') throw inscripciones.reason;
    // Primero el Módulo 9: si no cursa ahí es 404, responda lo que responda el Módulo 2
    const inscripcion = inscripcionDelCurso(inscripciones.value, cursoId);
    if (!inscripcion) throw cursadaNoEncontrada();

    const fuentes = new FuentesConError(this.logger);
    const delCurso = fuentes.de(notas, 'notas');
    return {
      ...aCursadaDetalle(inscripcion, fuentes.de(finales, 'nota final')?.get(cursoId) ?? null),
      asistencia: fuentes.de(asistencia, 'asistencia'),
      notas: delCurso?.notas.map(aNotaResumen) ?? null,
      promedio: delCurso?.promedio ?? null,
      fuentesConError: fuentes.lista(),
    };
  }

  /**
   * Detalle de una nota. Acá el Módulo 2 es la fuente principal: si falla, falla la pantalla.
   * El Módulo 9 aporta materia y comisión y confirma que el curso es del alumno; si no lo es,
   * es 404 aunque el Módulo 2 tenga la nota. El nombre del docente es accesorio: si
   * Backoffice falla, la nota sale sin él.
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
      ...aNotaResumen(nota.value),
      cursoId: inscripcion.cursoId,
      asignatura: inscripcion.asignatura,
      ...(inscripcion.comision !== undefined && { comision: inscripcion.comision }),
      docente: await this.nombreDocente(nota.value.docenteId),
    };
  }

  private async nombreDocente(docenteId: string | null): Promise<string | null> {
    if (!docenteId) return null;
    try {
      return await this.backoffice.nombreDeUsuario(docenteId);
    } catch (err) {
      this.logger.warn({ err }, 'No se pudo obtener el nombre del docente de Backoffice');
      return null;
    }
  }
}

/** Partes accesorias del Módulo 2: si una falla, queda en null y el módulo se informa. */
class FuentesConError {
  private readonly modulos = new Set<ModuloExterno>();

  constructor(private readonly logger: Logger) {}

  de<T>(resultado: PromiseSettledResult<T>, parte: string): T | null {
    if (resultado.status === 'fulfilled') return resultado.value;
    const code = resultado.reason instanceof ProblemaError ? resultado.reason.code : undefined;
    this.logger.warn({ err: resultado.reason, parte, code }, 'Falló el Módulo 2');
    this.modulos.add('DOCENTE');
    return null;
  }

  lista(): ModuloExterno[] {
    return [...this.modulos];
  }
}

const cursadaNoEncontrada = () =>
  new ProblemaError(404, 'CURSADA_NO_ENCONTRADA', 'La cursada no existe', {
    modulo: 'GESTION_ACADEMICA',
  });
