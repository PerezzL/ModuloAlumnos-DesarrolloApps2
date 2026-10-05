import { Injectable } from '@nestjs/common';
import type { PaginaCompras } from '@uadenet/api-types';
import { GatewayClient } from '../../gateway/gateway.client';
import { aPaginaCompras } from './tienda.mapper';

export interface FiltrosCompras {
  desde?: string;
  hasta?: string;
  estado?: string;
  /** Pedido al Módulo 5, sin confirmar */
  sede?: string;
}

export interface ConsultaCompras {
  page: number;
  limit: number;
  filtros: FiltrosCompras;
}

/** Módulo 5 · Tienda. Único lugar que conoce la forma de sus respuestas. */
@Injectable()
export class TiendaAdapter {
  constructor(private readonly gateway: GatewayClient) {}

  /** Compras del alumno del token; la Tienda las identifica por el token, no por parámetro. */
  async compras({ page, limit, filtros }: ConsultaCompras): Promise<PaginaCompras> {
    // Nombres de los filtros PROVISIONALES: la Tienda ofreció filtrar por fecha y estado (y le
    // pedimos sede), pero no dijo cómo se llaman los parámetros (docs/integraciones.md)
    return aPaginaCompras(
      await this.gateway.get('TIENDA', '/orders/me', { query: { page, limit, ...filtros } }),
    );
  }
}
