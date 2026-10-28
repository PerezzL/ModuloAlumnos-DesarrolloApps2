import { Module } from '@nestjs/common';
import { BackofficeModule } from '../backoffice/backoffice.module';
import { TiendaAdapter } from './tienda.adapter';

@Module({ imports: [BackofficeModule], providers: [TiendaAdapter], exports: [TiendaAdapter] })
export class TiendaModule {}
