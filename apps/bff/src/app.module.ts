import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtGuard } from './auth/jwt.guard';
import { CalendarioModule } from './calendario/calendario.module';
import { ProblemaFilter } from './comun/problema.filter';
import { LoggerModule } from './comun/logger.module';
import { ConfigModule } from './config/config.module';
import { GatewayModule } from './gateway/gateway.module';
import { HealthController } from './health/health.controller';
import { PerfilModule } from './perfil/perfil.module';

@Module({
  imports: [ConfigModule, LoggerModule, GatewayModule, PerfilModule, CalendarioModule],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: ProblemaFilter },
    { provide: APP_GUARD, useClass: JwtGuard },
  ],
})
export class AppModule {}
