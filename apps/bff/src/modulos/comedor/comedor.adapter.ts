import { Injectable } from '@nestjs/common';
import type { ItemCalendario } from '@uadenet/api-types';
import type { Rango } from '../../calendario/rango';
import { GatewayClient } from '../../gateway/gateway.client';
import { reservasAItems } from './comedor.mapper';

/** Módulo 4 · Comedor. Único lugar que conoce la forma de sus respuestas. */
@Injectable()
export class ComedorAdapter {
  constructor(private readonly gateway: GatewayClient) {}

  async reservas(rango: Rango): Promise<ItemCalendario[]> {
    return reservasAItems(await this.gateway.get('COMEDOR', '/reservations/me'), rango);
  }
}
