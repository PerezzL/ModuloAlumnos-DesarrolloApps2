import { Controller, Get, Param, Query } from '@nestjs/common';
import type { CompraDetalle, PaginaCompras } from '@uadenet/api-types';
import { TiendaAdapter } from '../modulos/tienda/tienda.adapter';
import { parsearConsultaCompras } from './parametros';

/** Historial de compras en la Tienda (RF8, pantalla 4.10). Solo lectura, en vivo. */
@Controller('compras')
export class ComprasController {
  constructor(private readonly tienda: TiendaAdapter) {}

  /** `GET /compras?cursor=&limit=&desde=&hasta=&estado=&sede=` */
  @Get()
  listar(@Query() query: Record<string, unknown>): Promise<PaginaCompras> {
    return this.tienda.compras(parsearConsultaCompras(query));
  }

  /** `GET /compras/{orderId}` */
  @Get(':orderId')
  detalle(@Param('orderId') orderId: string): Promise<CompraDetalle> {
    return this.tienda.compra(orderId);
  }
}
