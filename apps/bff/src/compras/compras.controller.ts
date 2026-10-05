import { Controller, Get, Query } from '@nestjs/common';
import type { PaginaCompras } from '@uadenet/api-types';
import { TiendaAdapter } from '../modulos/tienda/tienda.adapter';
import { parsearConsultaCompras } from './parametros';

/** Historial de compras en la Tienda (RF8, pantalla 4.10). Solo lectura, en vivo. */
@Controller('compras')
export class ComprasController {
  constructor(private readonly tienda: TiendaAdapter) {}

  /** `GET /compras?page=&limit=` */
  @Get()
  listar(@Query() query: Record<string, unknown>): Promise<PaginaCompras> {
    return this.tienda.compras(parsearConsultaCompras(query));
  }
}
