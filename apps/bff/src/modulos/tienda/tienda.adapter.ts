import { Injectable } from '@nestjs/common';
import type { PaginaCompras } from '@uadenet/api-types';
import { GatewayClient } from '../../gateway/gateway.client';
import { aPaginaCompras } from './tienda.mapper';

export interface ConsultaCompras {
  page: number;
  limit: number;
}

/** Módulo 5 · Tienda. Único lugar que conoce la forma de sus respuestas. */
@Injectable()
export class TiendaAdapter {
  constructor(private readonly gateway: GatewayClient) {}

  /** Compras del alumno del token; la Tienda las identifica por el token, no por parámetro. */
  async compras({ page, limit }: ConsultaCompras): Promise<PaginaCompras> {
    return aPaginaCompras(
      await this.gateway.get('TIENDA', '/orders/me', { query: { page, limit } }),
    );
  }
}
