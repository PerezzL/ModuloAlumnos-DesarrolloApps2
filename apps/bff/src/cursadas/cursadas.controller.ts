import { Controller, Get, Param, Query } from '@nestjs/common';
import type { CursadaDetalle, CursadaResumen } from '@uadenet/api-types';
import { type Alumno, AlumnoActual } from '../auth/alumno.decorator';
import { idOpcional } from '../comun/parametros';
import { ProblemaError } from '../comun/problema';
import { AcademicoAdapter } from '../modulos/academico/academico.adapter';
import { aCursadaDetalle, inscripcionDelCurso } from './detalle';
import { aHistorial } from './historial';

/** Historial académico y detalle de cursada (RF3, pantallas 4.4 y 4.5). Consulta en vivo. */
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

  /** `GET /cursadas/{cursoId}`. Solo cursos en los que el alumno del token está inscripto. */
  @Get(':cursoId')
  async detalle(
    @AlumnoActual() alumno: Alumno,
    @Param('cursoId') cursoId: string,
  ): Promise<CursadaDetalle> {
    const inscripcion = inscripcionDelCurso(await this.academico.inscripciones(alumno.id), cursoId);
    if (!inscripcion) throw cursadaNoEncontrada();
    return aCursadaDetalle(inscripcion);
  }
}

const cursadaNoEncontrada = () =>
  new ProblemaError(404, 'CURSADA_NO_ENCONTRADA', 'La cursada no existe', {
    modulo: 'GESTION_ACADEMICA',
  });
