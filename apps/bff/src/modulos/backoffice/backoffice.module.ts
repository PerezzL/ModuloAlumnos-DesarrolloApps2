import { Module } from '@nestjs/common';
import { TokenServicio } from '../../servicio/token-servicio';
import { BackofficeAdapter } from './backoffice.adapter';
import { BackofficeInternoClient } from './backoffice.interno';

@Module({
  providers: [TokenServicio, BackofficeInternoClient, BackofficeAdapter],
  exports: [BackofficeAdapter],
})
export class BackofficeModule {}
