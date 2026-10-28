import { Controller, Get } from '@nestjs/common';
import type { Perfil } from '@uadenet/api-types';
import { type Alumno, AlumnoActual } from '../auth/alumno.decorator';
import { PerfilService } from './perfil.service';

/** `GET /me`: identidad de CORE (el token) + datos personales de Backoffice. */
@Controller('me')
export class PerfilController {
  constructor(private readonly perfiles: PerfilService) {}

  @Get()
  perfil(@AlumnoActual() alumno: Alumno): Promise<Perfil> {
    return this.perfiles.perfil(alumno);
  }
}
