import { Injectable, Logger } from '@nestjs/common';
import type { Inscripcion, OfertaInscripcion } from '@uadenet/api-types';
import type { Alumno } from '../auth/alumno.decorator';
import { AcademicoAdapter } from '../modulos/academico/academico.adapter';
import type { CursoOfertado } from '../modulos/academico/academico.modelo';
import { BackofficeAdapter } from '../modulos/backoffice/backoffice.adapter';
import type { FichaAlumno } from '../modulos/backoffice/backoffice.modelo';
import { armarOferta, cursosDelPlan, elegirPeriodo } from './oferta';

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
    const cursos = planId === null ? [] : await this.cursosDelPlan(periodo.id, planId);
    const asignaturas = [...new Set(cursos.map((c) => c.asignatura.id))];
    const correlativas = new Map(
      await Promise.all(
        asignaturas.map(async (id) => [id, await this.academico.correlativas(id)] as const),
      ),
    );
    return armarOferta({
      periodo,
      cursos,
      inscripciones,
      correlativas,
      filtradaPorPlan: planId !== null,
      ahora,
    });
  }

  /** El id del alumno sale del token; el portal no guarda la inscripción. */
  inscribir(alumno: Alumno, cursoId: string): Promise<Inscripcion> {
    return this.academico.inscribir(alumno.id, cursoId);
  }

  private async cursosDelPlan(periodoId: string, planId: string): Promise<CursoOfertado[]> {
    const [cursos, asignaturas] = await Promise.all([
      this.academico.cursos(periodoId),
      this.academico.asignaturasDelPlan(planId),
    ]);
    return cursosDelPlan(cursos, asignaturas);
  }

  /**
   * Plan del alumno: el del token (`planIds`); si no trae, el que informa Backoffice para su
   * carrera y, si tampoco, el plan activo de esa carrera en el Módulo 9. La carrera sale del token o de Backoffice. Sin plan,
   * la oferta sale vacía (decisión 11, docs/plan.md): el Módulo 9 solo da el nombre de las
   * materias por plan. Si Backoffice o el catálogo de carreras fallan, se sigue sin ese dato.
   */
  private async planId(alumno: Alumno): Promise<string | null> {
    const delToken = alumno.planIds?.[0];
    if (delToken !== undefined) return delToken;
    const ficha = await this.fichaOpcional(alumno);
    const planId = ficha?.perfil.planId ?? null;
    if (planId !== null) return planId;
    const carreraId = ficha?.carreraId ?? alumno.carreraIds?.[0] ?? null;
    if (carreraId === null) {
      this.logger.warn('No se conoce la carrera del alumno: la oferta sale sin plan');
      return null;
    }
    try {
      const activo = await this.academico.planActivo(carreraId);
      if (activo === null) this.logger.warn({ carreraId }, 'La carrera no tiene plan activo');
      return activo;
    } catch (error) {
      this.logger.warn({ err: error }, 'No se pudo obtener el plan activo de la carrera');
      return null;
    }
  }

  private async fichaOpcional(alumno: Alumno): Promise<FichaAlumno | null> {
    try {
      return await this.backoffice.ficha(alumno);
    } catch (error) {
      this.logger.warn({ err: error }, 'No se pudo obtener la ficha de Backoffice');
      return null;
    }
  }
}
