import { Injectable } from '@nestjs/common';
import type { CompraDetalle, PaginaCompras } from '@uadenet/api-types';
import { ProblemaError } from '../../comun/problema';
import { GatewayClient, RespuestaModuloError } from '../../gateway/gateway.client';
import { aCompraDetalle, aPaginaCompras } from './tienda.mapper';

export interface FiltrosCompras {
  desde?: string;
  hasta?: string;
  estado?: string;
  /** `siteId` de Backoffice. Pedido al Módulo 5, sin confirmar */
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

  /** Una compra propia. Inexistente o de otro alumno, para el portal es lo mismo: 404. */
  async compra(orderId: string): Promise<CompraDetalle> {
    try {
      return aCompraDetalle(
        await this.gateway.get('TIENDA', `/orders/${encodeURIComponent(orderId)}`),
      );
    } catch (error) {
      if (
        error instanceof RespuestaModuloError &&
        (error.estadoOrigen === 404 || error.estadoOrigen === 403)
      ) {
        throw new ProblemaError(404, 'COMPRA_NO_ENCONTRADA', 'La compra no existe', {
          modulo: 'TIENDA',
        });
      }
      throw error;
    }
  }
}
