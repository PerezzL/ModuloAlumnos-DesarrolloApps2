import { Controller, Get, Query } from '@nestjs/common';
import type { OfertaInscripcion } from '@uadenet/api-types';
import { type Alumno, AlumnoActual } from '../auth/alumno.decorator';
import { InscripcionService } from './inscripcion.service';
import { idOpcional } from './parametros';

/** Inscripción a materias (RF2, pantalla 4.3) */
@Controller()
export class InscripcionController {
  constructor(private readonly inscripcion: InscripcionService) {}

  /** `GET /inscripcion/oferta?periodoId=` */
  @Get('inscripcion/oferta')
  oferta(
    @AlumnoActual() alumno: Alumno,
    @Query('periodoId') periodoId: unknown,
  ): Promise<OfertaInscripcion> {
    return this.inscripcion.oferta(alumno, idOpcional('periodoId', periodoId));
  }
}
