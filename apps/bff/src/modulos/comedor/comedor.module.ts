import { Module } from '@nestjs/common';
import { BackofficeModule } from '../backoffice/backoffice.module';
import { ComedorAdapter } from './comedor.adapter';

@Module({ imports: [BackofficeModule], providers: [ComedorAdapter], exports: [ComedorAdapter] })
export class ComedorModule {}
