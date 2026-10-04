import { Injectable } from '@nestjs/common';
import type { ItemCalendario } from '@uadenet/api-types';
import { inicioDelDia, type Rango, sumarDias } from '../../calendario/rango';
import { GatewayClient } from '../../gateway/gateway.client';
import { eventosAItems } from './eventos.mapper';

/** Módulo 6 · Eventos Académicos. Único lugar que conoce la forma de sus respuestas. */
@Injectable()
export class EventosAdapter {
  constructor(private readonly gateway: GatewayClient) {}

  /**
   * Eventos del rango a los que el alumno se inscribió. El GatewayClient reenvía el token del
   * alumno: `yaInscripto` se calcula contra él. Se pide hasta las 00:00 del día siguiente a
   * `hasta`, así el último día entra sea `hasta` inclusivo o no (pendiente con el Módulo 6).
   */
  async inscriptos(rango: Rango): Promise<ItemCalendario[]> {
    const datos = await this.gateway.get('EVENTOS', '/eventos', {
      query: { desde: inicioDelDia(rango.desde), hasta: inicioDelDia(sumarDias(rango.hasta, 1)) },
    });
    return eventosAItems(datos, rango);
  }
}
