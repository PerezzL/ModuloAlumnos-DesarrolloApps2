import { Injectable, Logger } from '@nestjs/common';
import type { OfertaInscripcion } from '@uadenet/api-types';
import type { Alumno } from '../auth/alumno.decorator';
import { AcademicoAdapter } from '../modulos/academico/academico.adapter';
import { BackofficeAdapter } from '../modulos/backoffice/backoffice.adapter';
import { armarOferta, elegirPeriodo } from './oferta';

/** Oferta e inscripción (RF2). El portal no persiste nada: consulta y comanda al Módulo 9. */
@Injectable()
export class InscripcionService {
  private readonly logger = new Logger(InscripcionService.name);

  constructor(
    private readonly academico: AcademicoAdapter,
    private readonly backoffice: BackofficeAdapter,
  ) {}

  async oferta(alumno: Alumno, periodoId?: string): Promise<OfertaInscripcion> {
    const [planId, periodos, inscripciones] = await Promise.all([
      this.planId(alumno),
      this.academico.periodos(),
      this.academico.inscripciones(alumno.id),
    ]);
    const ahora = new Date();
    const periodo = elegirPeriodo(periodos, ahora, periodoId);
    const cursos = await this.academico.cursos(periodo.id, planId);
    return armarOferta({
      periodo,
      cursos,
      inscripciones,
      filtradaPorPlan: planId !== null,
      ahora,
    });
  }

  /**
   * El `planId` debería venir de Backoffice, pero todavía no está confirmado. Si no viene o
   * Backoffice no responde, la oferta se pide sin filtrar por plan en lugar de fallar
   * (decisión del bloque D, docs/plan.md).
   */
  private async planId(alumno: Alumno): Promise<string | null> {
    try {
      const planId = await this.backoffice.planId(alumno);
      if (planId === null) this.logger.warn('Backoffice no informa el planId del alumno');
      return planId;
    } catch (error) {
      this.logger.warn({ err: error }, 'No se pudo obtener el planId de Backoffice');
      return null;
    }
  }
}
