import { Injectable } from '@nestjs/common';
import type { Asistencia, NotaResumen } from '@uadenet/api-types';
import { ProblemaError } from '../../comun/problema';
import { GatewayClient, RespuestaModuloError } from '../../gateway/gateway.client';
import { aAsistencia, aNotaConDocente, aNotas } from './docente.mapper';
import type { NotaConDocente } from './docente.modelo';

/**
 * Módulo 2 · Docente. Único lugar que conoce la forma de sus respuestas. No tiene contrato:
 * las rutas son una suposición nuestra (docs/integraciones.md).
 */
@Injectable()
export class DocenteAdapter {
  constructor(private readonly gateway: GatewayClient) {}

  /** Asistencia del alumno en el curso */
  async asistencia(alumnoId: string, cursoId: string): Promise<Asistencia> {
    return aAsistencia(
      await this.gateway.get('DOCENTE', `${rutaAlumno(cursoId, alumnoId)}/asistencia`),
    );
  }

  /** Notas parciales y finales del alumno en el curso */
  async notas(alumnoId: string, cursoId: string): Promise<NotaResumen[]> {
    return aNotas(await this.gateway.get('DOCENTE', `${rutaAlumno(cursoId, alumnoId)}/notas`));
  }

  /** Una nota del alumno. Inexistente o de otro alumno, para el portal es lo mismo: 404. */
  async nota(alumnoId: string, cursoId: string, notaId: string): Promise<NotaConDocente> {
    try {
      return aNotaConDocente(
        await this.gateway.get(
          'DOCENTE',
          `${rutaAlumno(cursoId, alumnoId)}/notas/${encodeURIComponent(notaId)}`,
        ),
      );
    } catch (error) {
      if (
        error instanceof RespuestaModuloError &&
        (error.estadoOrigen === 404 || error.estadoOrigen === 403)
      ) {
        throw notaNoEncontrada();
      }
      throw error;
    }
  }
}

export const notaNoEncontrada = () =>
  new ProblemaError(404, 'NOTA_NO_ENCONTRADA', 'La nota no existe', { modulo: 'DOCENTE' });

const rutaAlumno = (cursoId: string, alumnoId: string) =>
  `/cursos/${encodeURIComponent(cursoId)}/alumnos/${encodeURIComponent(alumnoId)}`;
