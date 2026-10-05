import { Module } from '@nestjs/common';
import { TiendaAdapter } from './tienda.adapter';

@Module({ providers: [TiendaAdapter], exports: [TiendaAdapter] })
export class TiendaModule {}
