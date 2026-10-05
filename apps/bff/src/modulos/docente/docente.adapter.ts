import { Injectable } from '@nestjs/common';
import type { Asistencia } from '@uadenet/api-types';
import { GatewayClient } from '../../gateway/gateway.client';
import { aAsistencia } from './docente.mapper';

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
}

const rutaAlumno = (cursoId: string, alumnoId: string) =>
  `/cursos/${encodeURIComponent(cursoId)}/alumnos/${encodeURIComponent(alumnoId)}`;
