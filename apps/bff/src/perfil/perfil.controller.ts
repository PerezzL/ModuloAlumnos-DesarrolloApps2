import { Controller, Get } from '@nestjs/common';
import type { Perfil } from '@uadenet/api-types';
import { type Alumno, AlumnoActual } from '../auth/alumno.decorator';
import { BackofficeAdapter } from '../modulos/backoffice/backoffice.adapter';

/** `GET /me`: identidad de CORE (el token) + datos personales de Backoffice. */
@Controller('me')
export class PerfilController {
  constructor(private readonly backoffice: BackofficeAdapter) {}

  @Get()
  perfil(@AlumnoActual() alumno: Alumno): Promise<Perfil> {
    return this.backoffice.perfil(alumno);
  }
}
