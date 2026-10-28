import { Module } from '@nestjs/common';
import { AcademicoModule } from '../modulos/academico/academico.module';
import { BackofficeModule } from '../modulos/backoffice/backoffice.module';
import { PerfilController } from './perfil.controller';
import { PerfilService } from './perfil.service';

@Module({
  imports: [BackofficeModule, AcademicoModule],
  controllers: [PerfilController],
  providers: [PerfilService],
})
export class PerfilModule {}
