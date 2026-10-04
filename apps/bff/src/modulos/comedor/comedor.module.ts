import { Module } from '@nestjs/common';
import { ComedorAdapter } from './comedor.adapter';

@Module({ providers: [ComedorAdapter], exports: [ComedorAdapter] })
export class ComedorModule {}
