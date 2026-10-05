import { Module } from '@nestjs/common';
import { AcademicoModule } from '../modulos/academico/academico.module';
import { ComedorModule } from '../modulos/comedor/comedor.module';
import { EventosModule } from '../modulos/eventos/eventos.module';
import { CalendarioController } from './calendario.controller';
import { CalendarioService } from './calendario.service';

@Module({
  imports: [ComedorModule, EventosModule, AcademicoModule],
  controllers: [CalendarioController],
  providers: [CalendarioService],
})
export class CalendarioModule {}
