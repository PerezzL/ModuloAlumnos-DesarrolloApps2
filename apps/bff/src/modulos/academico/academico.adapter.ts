import { Injectable } from '@nestjs/common';
import type { Inscripcion, ItemCalendario } from '@uadenet/api-types';
import type { Rango } from '../../calendario/rango';
import { CacheTtl } from '../../comun/cache';
import { ProblemaError } from '../../comun/problema';
import { GatewayClient, RespuestaModuloError } from '../../gateway/gateway.client';
import type {
  Correlativa,
  CursoOfertado,
  InscripcionAlumno,
  PeriodoAcademico,
} from './academico.modelo';
import {
  aCorrelativas,
  aCursos,
  aInscripcion,
  aInscripciones,
  aPeriodos,
  aRechazoInscripcion,
  turnosAItems,
} from './academico.mapper';

/** Las correlatividades cambian con el plan de estudios: casi nunca. */
const TTL_CORRELATIVIDADES_MS = 60 * 60 * 1000;

/** Módulo 9 · Gestión Académica. Único lugar que conoce la forma de sus respuestas. */
@Injectable()
export class AcademicoAdapter {
  // Las correlativas traen el nombre de cada asignatura: con esto se cachean los dos datos
  private readonly correlatividades = new CacheTtl<Correlativa[]>(TTL_CORRELATIVIDADES_MS);

  constructor(private readonly gateway: GatewayClient) {}

  async turnosExamen(rango: Rango): Promise<ItemCalendario[]> {
    return turnosAItems(
      await this.gateway.get('GESTION_ACADEMICA', '/planificacion/turnos-examen'),
      rango,
    );
  }

  async periodos(): Promise<PeriodoAcademico[]> {
    return aPeriodos(await this.gateway.get('GESTION_ACADEMICA', '/planificacion/periodos'));
  }

  /** Comisiones del período. Sin `planId`, el Módulo 9 devuelve las de todos los planes. */
  async cursos(periodoId: string, planId: string | null): Promise<CursoOfertado[]> {
    return aCursos(
      await this.gateway.get('GESTION_ACADEMICA', '/planificacion/cursos', {
        query: { periodoId, planId: planId ?? undefined },
      }),
    );
  }

  /** Inscripciones del alumno (su historial). Sin `periodoId`, todas. */
  async inscripciones(alumnoId: string, periodoId?: string): Promise<InscripcionAlumno[]> {
    return aInscripciones(
      await this.gateway.get(
        'GESTION_ACADEMICA',
        `/planificacion/alumnos/${encodeURIComponent(alumnoId)}/inscripciones`,
        { query: { periodoId } },
      ),
    );
  }

  /** Correlativas de una asignatura. Si el Módulo 9 no la conoce, no tiene correlativas. */
  correlativas(asignaturaId: string): Promise<Correlativa[]> {
    return this.correlatividades.obtener(asignaturaId, async () => {
      try {
        return aCorrelativas(
          await this.gateway.get(
            'GESTION_ACADEMICA',
            `/academica/asignaturas/${encodeURIComponent(asignaturaId)}/correlatividades`,
          ),
        );
      } catch (error) {
        if (error instanceof RespuestaModuloError && error.estadoOrigen === 404) return [];
        throw error;
      }
    });
  }

  /**
   * Comanda la inscripción. El Módulo 9 es la fuente de verdad y vuelve a validar todo.
   * No se reintenta: el GatewayClient nunca repite un POST.
   */
  async inscribir(alumnoId: string, cursoId: string): Promise<Inscripcion> {
    try {
      return aInscripcion(
        await this.gateway.post(
          'GESTION_ACADEMICA',
          `/planificacion/cursos/${encodeURIComponent(cursoId)}/inscripciones`,
          { alumnoId },
        ),
      );
    } catch (error) {
      if (error instanceof RespuestaModuloError && error.estadoOrigen === 404) {
        throw new ProblemaError(404, 'CURSO_NO_ENCONTRADO', 'La comisión no existe', {
          modulo: 'GESTION_ACADEMICA',
        });
      }
      if (error instanceof RespuestaModuloError && error.estadoOrigen === 409) {
        throw aRechazoInscripcion(error.cuerpoOrigen);
      }
      throw error;
    }
  }
}
