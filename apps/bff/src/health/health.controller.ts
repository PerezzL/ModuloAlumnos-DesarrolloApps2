import { Controller, Get } from '@nestjs/common';

export const estadoHealth = () => ({ status: 'ok' as const });

/**
 * Health checks que pide CORE. Se exponen bajo el prefijo /api/v1 (lo que llega por el
 * Gateway) y también en la raíz (ver main.ts), que es donde los consulta la infraestructura.
 * El BFF no tiene dependencias propias que chequear: si la configuración cargó, está listo.
 */
@Controller('health')
export class HealthController {
  @Get('live')
  live() {
    return estadoHealth();
  }

  @Get('ready')
  ready() {
    return estadoHealth();
  }
}
