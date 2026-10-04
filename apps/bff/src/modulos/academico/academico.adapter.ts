import { Injectable } from '@nestjs/common';
import type { ItemCalendario } from '@uadenet/api-types';
import type { Rango } from '../../calendario/rango';
import { GatewayClient } from '../../gateway/gateway.client';
import type { CursoOfertado, PeriodoAcademico } from './academico.modelo';
import { aCursos, aPeriodos, turnosAItems } from './academico.mapper';

/** Módulo 9 · Gestión Académica. Único lugar que conoce la forma de sus respuestas. */
@Injectable()
export class AcademicoAdapter {
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
}
