import { Module } from '@nestjs/common';
import { BackofficeAdapter } from './backoffice.adapter';

@Module({ providers: [BackofficeAdapter], exports: [BackofficeAdapter] })
export class BackofficeModule {}
