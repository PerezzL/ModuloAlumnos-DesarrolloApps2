import { Module } from '@nestjs/common';
import { AcademicoModule } from '../modulos/academico/academico.module';
import { BackofficeModule } from '../modulos/backoffice/backoffice.module';
import { InscripcionController } from './inscripcion.controller';
import { InscripcionService } from './inscripcion.service';

@Module({
  imports: [AcademicoModule, BackofficeModule],
  controllers: [InscripcionController],
  providers: [InscripcionService],
})
export class InscripcionModule {}
