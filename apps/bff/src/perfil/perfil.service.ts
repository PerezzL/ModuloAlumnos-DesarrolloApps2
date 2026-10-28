import { Injectable, Logger } from '@nestjs/common';
import type { Perfil } from '@uadenet/api-types';
import type { Alumno } from '../auth/alumno.decorator';
import { AcademicoAdapter } from '../modulos/academico/academico.adapter';
import { BackofficeAdapter } from '../modulos/backoffice/backoffice.adapter';

/**
 * `GET /me`: identidad de CORE (el token) + ficha de Backoffice + nombre de la carrera del
 * Módulo 9 (Backoffice solo da el id). Si el nombre no se puede resolver, el perfil sale
 * igual sin `carrera`: es un dato provisional y de presentación.
 */
@Injectable()
export class PerfilService {
  private readonly logger = new Logger(PerfilService.name);

  constructor(
    private readonly backoffice: BackofficeAdapter,
    private readonly academico: AcademicoAdapter,
  ) {}

  async perfil(alumno: Alumno): Promise<Perfil> {
    const { perfil, carreraId } = await this.backoffice.ficha(alumno);
    if (carreraId === null) return perfil;
    const carrera = await this.nombreCarrera(carreraId);
    return carrera === null ? perfil : { ...perfil, carrera };
  }

  private async nombreCarrera(carreraId: string): Promise<string | null> {
    try {
      const nombre = await this.academico.nombreCarrera(carreraId);
      if (nombre === null) this.logger.warn({ carreraId }, 'El Módulo 9 no conoce la carrera');
      return nombre;
    } catch (error) {
      this.logger.warn({ err: error }, 'No se pudo obtener el nombre de la carrera');
      return null;
    }
  }
}
