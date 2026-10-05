import { Module } from '@nestjs/common';
import { DocenteAdapter } from './docente.adapter';

@Module({ providers: [DocenteAdapter], exports: [DocenteAdapter] })
export class DocenteModule {}
