import { Module } from '@nestjs/common';
import { TiendaModule } from '../modulos/tienda/tienda.module';
import { ComprasController } from './compras.controller';

@Module({ imports: [TiendaModule], controllers: [ComprasController] })
export class ComprasModule {}
