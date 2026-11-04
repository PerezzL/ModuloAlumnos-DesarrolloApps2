import { Module } from '@nestjs/common';
import { AcademicoModule } from '../modulos/academico/academico.module';
import { BackofficeModule } from '../modulos/backoffice/backoffice.module';
import { DocenteModule } from '../modulos/docente/docente.module';
import { CursadasController } from './cursadas.controller';
import { CursadasService } from './cursadas.service';

@Module({
  imports: [AcademicoModule, BackofficeModule, DocenteModule],
  controllers: [CursadasController],
  providers: [CursadasService],
})
export class CursadasModule {}
