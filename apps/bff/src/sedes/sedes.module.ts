import { Module } from '@nestjs/common';
import { BackofficeModule } from '../modulos/backoffice/backoffice.module';
import { SedesController } from './sedes.controller';

@Module({ imports: [BackofficeModule], controllers: [SedesController] })
export class SedesModule {}
