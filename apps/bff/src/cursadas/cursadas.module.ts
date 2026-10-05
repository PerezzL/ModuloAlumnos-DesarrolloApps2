import { Module } from '@nestjs/common';
import { AcademicoModule } from '../modulos/academico/academico.module';
import { CursadasController } from './cursadas.controller';

@Module({ imports: [AcademicoModule], controllers: [CursadasController] })
export class CursadasModule {}
