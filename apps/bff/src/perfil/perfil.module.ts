import { Module } from '@nestjs/common';
import { BackofficeModule } from '../modulos/backoffice/backoffice.module';
import { PerfilController } from './perfil.controller';

@Module({ imports: [BackofficeModule], controllers: [PerfilController] })
export class PerfilModule {}
