import { Injectable, Logger } from '@nestjs/common';
import type { ItemCalendario } from '@uadenet/api-types';
import { type Rango, sumarDias } from '../../calendario/rango';
import { GatewayClient } from '../../gateway/gateway.client';
import { BackofficeAdapter } from '../backoffice/backoffice.adapter';
import { turnosAItems } from './comedor.mapper';

/** Módulo 4 · Comedor. Único lugar que conoce la forma de sus respuestas. */
@Injectable()
export class ComedorAdapter {
  private readonly logger = new Logger(ComedorAdapter.name);

  constructor(
    private readonly gateway: GatewayClient,
    private readonly backoffice: BackofficeAdapter,
  ) {}

  /**
   * Turnos del alumno en el rango. `from` y `to` son fechas sin hora: se pide un día de más
   * por si Comedor las toma en UTC (un turno a la noche del último día ya es el día siguiente
   * en UTC) y el mapper recorta en hora de Argentina. Comedor y las sedes se piden en
   * paralelo; sin sedes, el turno sale igual sin lugar.
   */
  async turnos(rango: Rango): Promise<ItemCalendario[]> {
    const [turnos, sedes] = await Promise.all([
      this.gateway.get('COMEDOR', '/calendar/me', {
        query: { from: rango.desde, to: sumarDias(rango.hasta, 1) },
      }),
      this.backoffice.nombresDeSedes().catch((err: unknown) => {
        this.logger.warn({ err }, 'Sin nombres de sede: los turnos de comedor salen sin lugar');
        return new Map<string, string>();
      }),
    ]);
    return turnosAItems(turnos, rango, sedes);
  }
}
