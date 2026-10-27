import { Controller, Get } from '@nestjs/common';
import type { ListaSedes } from '@uadenet/api-types';
import { BackofficeAdapter } from '../modulos/backoffice/backoffice.adapter';

/** `GET /sedes`: catálogo de sedes de Backoffice, para el filtro por sede de Compras. */
@Controller('sedes')
export class SedesController {
  constructor(private readonly backoffice: BackofficeAdapter) {}

  @Get()
  listar(): Promise<ListaSedes> {
    return this.backoffice.sedes();
  }
}
