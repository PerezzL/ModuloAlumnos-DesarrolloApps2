import { Global, Module } from '@nestjs/common';
import { GatewayClient } from './gateway.client';

@Global()
@Module({ providers: [GatewayClient], exports: [GatewayClient] })
export class GatewayModule {}
