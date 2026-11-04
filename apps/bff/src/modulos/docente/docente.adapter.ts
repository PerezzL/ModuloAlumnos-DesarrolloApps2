import { Injectable } from '@nestjs/common';
import type { Asistencia } from '@uadenet/api-types';
import { ProblemaError } from '../../comun/problema';
import { GatewayClient, RespuestaModuloError } from '../../gateway/gateway.client';
import { aAsistencia, aNotasCurso, aNotasFinales } from './docente.mapper';
import type { NotaConDocente, NotasCurso } from './docente.modelo';

/**
 * Módulo 2 · Docente. Único lugar que conoce la forma de sus respuestas. Usa sus rutas por
 * alumno, que devuelven solo los datos del alumno del token (docs/integraciones.md).
 */
@Injectable()
export class DocenteAdapter {
  constructor(private readonly gateway: GatewayClient) {}

  /** Asistencia del alumno en el curso */
  async asistencia(alumnoId: string, cursoId: string): Promise<Asistencia> {
    return aAsistencia(
      await this.gateway.get('DOCENTE', `${rutaAlumno(alumnoId)}${rutaCurso(cursoId)}/attendance`),
    );
  }

  /** Notas del alumno en el curso (sin los exámenes cancelados) y su promedio */
  async notas(alumnoId: string, cursoId: string): Promise<NotasCurso> {
    return aNotasCurso(
      await this.gateway.get('DOCENTE', `${rutaAlumno(alumnoId)}${rutaCurso(cursoId)}/grades`),
    );
  }

  /**
   * Una nota del alumno. El Módulo 2 no tiene una ruta por examen para el alumno: sale de sus
   * notas del curso. Inexistente o de otro alumno, para el portal es lo mismo: 404.
   */
  async nota(alumnoId: string, cursoId: string, notaId: string): Promise<NotaConDocente> {
    let notas: NotasCurso;
    try {
      notas = await this.notas(alumnoId, cursoId);
    } catch (error) {
      if (
        error instanceof RespuestaModuloError &&
        (error.estadoOrigen === 404 || error.estadoOrigen === 403)
      ) {
        throw notaNoEncontrada();
      }
      throw error;
    }
    const nota = notas.notas.find((n) => n.notaId === notaId);
    if (!nota) throw notaNoEncontrada();
    return nota;
  }

  /**
   * Nota final por curso, de los resultados de actas del alumno. Con `cursoId`, solo la de
   * ese curso. Un curso sin acta no está en el mapa.
   */
  async notasFinales(
    alumnoId: string,
    cursoId?: string,
  ): Promise<ReadonlyMap<string, number | null>> {
    return aNotasFinales(
      await this.gateway.get('DOCENTE', `${rutaAlumno(alumnoId)}/results`, {
        query: { courseId: cursoId },
      }),
    );
  }
}

export const notaNoEncontrada = () =>
  new ProblemaError(404, 'NOTA_NO_ENCONTRADA', 'La nota no existe', { modulo: 'DOCENTE' });

const rutaAlumno = (alumnoId: string) => `/students/${encodeURIComponent(alumnoId)}`;
const rutaCurso = (cursoId: string) => `/courses/${encodeURIComponent(cursoId)}`;
