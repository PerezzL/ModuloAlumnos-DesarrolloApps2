import { Controller, Get, Query } from '@nestjs/common';
import type { CursadaResumen } from '@uadenet/api-types';
import { type Alumno, AlumnoActual } from '../auth/alumno.decorator';
import { idOpcional } from '../comun/parametros';
import { AcademicoAdapter } from '../modulos/academico/academico.adapter';
import { aHistorial } from './historial';

/** Historial académico (RF3, pantalla 4.4). Consulta en vivo: el portal no lo guarda. */
@Controller('cursadas')
export class CursadasController {
  constructor(private readonly academico: AcademicoAdapter) {}

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
}
