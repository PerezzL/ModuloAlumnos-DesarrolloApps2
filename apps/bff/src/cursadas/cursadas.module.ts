import { Module } from '@nestjs/common';
import { AcademicoModule } from '../modulos/academico/academico.module';
import { DocenteModule } from '../modulos/docente/docente.module';
import { CursadasController } from './cursadas.controller';
import { CursadasService } from './cursadas.service';

@Module({
  imports: [AcademicoModule, DocenteModule],
  controllers: [CursadasController],
  providers: [CursadasService],
})
export class CursadasModule {}
