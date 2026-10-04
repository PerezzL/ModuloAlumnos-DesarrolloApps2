import { Injectable } from '@nestjs/common';
import type { ItemCalendario } from '@uadenet/api-types';
import type { Rango } from '../../calendario/rango';
import { GatewayClient } from '../../gateway/gateway.client';
import { turnosAItems } from './academico.mapper';

/** Módulo 9 · Gestión Académica. Único lugar que conoce la forma de sus respuestas. */
@Injectable()
export class AcademicoAdapter {
  constructor(private readonly gateway: GatewayClient) {}

  async turnosExamen(rango: Rango): Promise<ItemCalendario[]> {
    return turnosAItems(
      await this.gateway.get('GESTION_ACADEMICA', '/planificacion/turnos-examen'),
      rango,
    );
  }
}
