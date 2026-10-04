import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ProblemaFilter } from './comun/problema.filter';
import { LoggerModule } from './comun/logger.module';
import { ConfigModule } from './config/config.module';
import { GatewayModule } from './gateway/gateway.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [ConfigModule, LoggerModule, GatewayModule],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: ProblemaFilter }],
})
export class AppModule {}
