import { Injectable } from '@nestjs/common';
import type { Asignatura, Inscripcion, ItemCalendario } from '@uadenet/api-types';
import type { Rango } from '../../calendario/rango';
import { CacheTtl } from '../../comun/cache';
import { ProblemaError } from '../../comun/problema';
import { GatewayClient, RespuestaModuloError } from '../../gateway/gateway.client';
import type {
  Correlativa,
  CursoDelPeriodo,
  InscripcionAlumno,
  PeriodoAcademico,
} from './academico.modelo';
import {
  aAsignaturasPlan,
  aCarreras,
  aCorrelativas,
  aCursos,
  aInscripcion,
  aInscripciones,
  aPeriodos,
  aPlanesActivos,
  aRechazoInscripcion,
  turnosAItems,
} from './academico.mapper';

/**
 * Datos de baja variación: correlatividades, materias del plan (nombres de asignatura) y el
 * catálogo de carreras. Ningún pedido depende de que estén cacheados.
 */
const TTL_CATALOGO_MS = 60 * 60 * 1000;

const es404 = (error: unknown) =>
  error instanceof RespuestaModuloError && error.estadoOrigen === 404;

/** Módulo 9 · Gestión Académica. Único lugar que conoce la forma de sus respuestas. */
@Injectable()
export class AcademicoAdapter {
  // Las correlativas traen el nombre de cada asignatura: con esto se cachean los dos datos
  private readonly correlatividades = new CacheTtl<Correlativa[]>(TTL_CATALOGO_MS);
  private readonly asignaturasPlan = new CacheTtl<Asignatura[]>(TTL_CATALOGO_MS);
  private readonly carreras = new CacheTtl<Map<string, string>>(TTL_CATALOGO_MS);
  private readonly planesActivos = new CacheTtl<Map<string, string>>(TTL_CATALOGO_MS);

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

  /** Comisiones que se ofrecen en el período, de todos los planes (el Módulo 9 no filtra). */
  async cursos(periodoId: string): Promise<CursoDelPeriodo[]> {
    return aCursos(
      await this.gateway.get('GESTION_ACADEMICA', '/planificacion/cursos', {
        query: { periodoId },
      }),
    );
  }

  /** Materias de un plan, con nombre y código. Un plan que el Módulo 9 no conoce no tiene. */
  asignaturasDelPlan(planId: string): Promise<Asignatura[]> {
    return this.asignaturasPlan.obtener(planId, async () => {
      try {
        return aAsignaturasPlan(
          await this.gateway.get(
            'GESTION_ACADEMICA',
            `/academica/planes/${encodeURIComponent(planId)}/asignaturas`,
          ),
        );
      } catch (error) {
        if (es404(error)) return [];
        throw error;
      }
    });
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

  /** Nombre de una carrera, o null si el Módulo 9 no la conoce. */
  async nombreCarrera(carreraId: string): Promise<string | null> {
    const carreras = await this.carreras.obtener('todas', async () =>
      aCarreras(await this.gateway.get('GESTION_ACADEMICA', '/academica/carreras')),
    );
    return carreras.get(carreraId) ?? null;
  }

  /** Plan activo de una carrera, o null si el Módulo 9 no la conoce o no tiene plan activo. */
  async planActivo(carreraId: string): Promise<string | null> {
    const planes = await this.planesActivos.obtener('todas', async () =>
      aPlanesActivos(
        await this.gateway.get('GESTION_ACADEMICA', '/academica/carreras/con-ultimo-plan-activo'),
      ),
    );
    return planes.get(carreraId) ?? null;
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
        if (es404(error)) return [];
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
        cursoId,
      );
    } catch (error) {
      if (es404(error)) {
        throw new ProblemaError(404, 'CURSO_NO_ENCONTRADO', 'La comisión no existe', {
          modulo: 'GESTION_ACADEMICA',
        });
      }
      if (error instanceof RespuestaModuloError) {
        throw aRechazoInscripcion(error.estadoOrigen, error.cuerpoOrigen) ?? error;
      }
      throw error;
    }
  }
}
