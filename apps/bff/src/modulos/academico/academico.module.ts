import { Module } from '@nestjs/common';
import { AcademicoAdapter } from './academico.adapter';

@Module({ providers: [AcademicoAdapter], exports: [AcademicoAdapter] })
export class AcademicoModule {}
