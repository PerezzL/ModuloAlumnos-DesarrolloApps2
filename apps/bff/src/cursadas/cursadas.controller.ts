import { Controller, Get, Param, Query } from '@nestjs/common';
import type { CursadaDetalle, CursadaResumen, NotaDetalle } from '@uadenet/api-types';
import { type Alumno, AlumnoActual } from '../auth/alumno.decorator';
import { idOpcional } from '../comun/parametros';
import { AcademicoAdapter } from '../modulos/academico/academico.adapter';
import { CursadasService } from './cursadas.service';
import { aHistorial } from './historial';

/** Historial, detalle de cursada y de nota (RF3 y RF4, pantallas 4.4, 4.5 y 4.7). En vivo. */
@Controller('cursadas')
export class CursadasController {
  constructor(
    private readonly academico: AcademicoAdapter,
    private readonly cursadas: CursadasService,
  ) {}

  /** `GET /cursadas?periodoId=` */
  @Get()
  async historial(
    @AlumnoActual() alumno: Alumno,
    @Query('periodoId') periodoId: unknown,
  ): Promise<{ items: CursadaResumen[] }> {
    const inscripciones = await this.academico.inscripciones(
      alumno.id,
      idOpcional('periodoId', periodoId),
    );
    return { items: aHistorial(inscripciones) };
  }

  /** `GET /cursadas/{cursoId}`. Solo cursos en los que el alumno del token está inscripto. */
  @Get(':cursoId')
  detalle(
    @AlumnoActual() alumno: Alumno,
    @Param('cursoId') cursoId: string,
  ): Promise<CursadaDetalle> {
    return this.cursadas.detalle(alumno.id, cursoId);
  }

  /** `GET /cursadas/{cursoId}/notas/{notaId}`. Solo notas del alumno del token. */
  @Get(':cursoId/notas/:notaId')
  nota(
    @AlumnoActual() alumno: Alumno,
    @Param('cursoId') cursoId: string,
    @Param('notaId') notaId: string,
  ): Promise<NotaDetalle> {
    return this.cursadas.nota(alumno.id, cursoId, notaId);
  }
}
