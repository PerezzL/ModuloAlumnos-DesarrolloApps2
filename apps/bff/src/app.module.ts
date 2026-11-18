import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { FirmaGuard } from './auth/firma.guard';
import { JwtGuard } from './auth/jwt.guard';
import { CalendarioModule } from './calendario/calendario.module';
import { ComprasModule } from './compras/compras.module';
import { ProblemaFilter } from './comun/problema.filter';
import { LoggerModule } from './comun/logger.module';
import { ConfigModule } from './config/config.module';
import { CursadasModule } from './cursadas/cursadas.module';
import { GatewayModule } from './gateway/gateway.module';
import { HealthController } from './health/health.controller';
import { InscripcionModule } from './inscripcion/inscripcion.module';
import { PerfilModule } from './perfil/perfil.module';
import { SedesModule } from './sedes/sedes.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    GatewayModule,
    PerfilModule,
    CalendarioModule,
    InscripcionModule,
    CursadasModule,
    ComprasModule,
    SedesModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: ProblemaFilter },
    // En este orden: primero la firma del Gateway, después el token
    { provide: APP_GUARD, useClass: FirmaGuard },
    { provide: APP_GUARD, useClass: JwtGuard },
  ],
})
export class AppModule {}
