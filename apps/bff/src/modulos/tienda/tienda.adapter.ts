import { Injectable, Logger } from '@nestjs/common';
import type { CompraDetalle, PaginaCompras } from '@uadenet/api-types';
import { solicitudInvalida } from '../../comun/parametros';
import { ProblemaError } from '../../comun/problema';
import { GatewayClient, RespuestaModuloError } from '../../gateway/gateway.client';
import { BackofficeAdapter } from '../backoffice/backoffice.adapter';
import { aCompraDetalle, aPaginaCompras } from './tienda.mapper';

export interface FiltrosCompras {
  /** `YYYY-MM-DD`, inclusive, en hora de Argentina */
  desde?: string;
  hasta?: string;
  estado?: string;
  /** `siteId` de Backoffice. Que la Tienda use el mismo id es suposición nuestra */
  sede?: string;
}

export interface ConsultaCompras {
  cursor?: string;
  limit: number;
  filtros: FiltrosCompras;
}

/** Módulo 5 · Tienda. Único lugar que conoce la forma de sus respuestas. */
@Injectable()
export class TiendaAdapter {
  private readonly logger = new Logger(TiendaAdapter.name);

  constructor(
    private readonly gateway: GatewayClient,
    private readonly backoffice: BackofficeAdapter,
  ) {}

  /** Nombres de sede de Backoffice; sin ellos, las compras salen igual con `sede: null` */
  private sedes(): Promise<ReadonlyMap<string, string>> {
    return this.backoffice.nombresDeSedes().catch((err: unknown) => {
      this.logger.warn({ err }, 'Sin nombres de sede: las compras salen sin sede');
      return new Map<string, string>();
    });
  }

  /**
   * Compras del alumno del token; la Tienda las identifica por el token, no por parámetro.
   * `desde` y `hasta` son días completos en hora de Argentina: la Tienda filtra `createdAt`
   * con `from` y `to` inclusive, en ISO 8601. Un 400 de la Tienda (cursor que no corresponde
   * a estos filtros) es un 400 nuestro.
   */
  async compras({ cursor, limit, filtros }: ConsultaCompras): Promise<PaginaCompras> {
    const { desde, hasta, estado, sede } = filtros;
    const [ordenes, sedes] = await Promise.all([
      this.gateway
        .get('TIENDA', '/orders/me', {
          query: {
            limit,
            cursor,
            from: desde && `${desde}T00:00:00.000-03:00`,
            to: hasta && `${hasta}T23:59:59.999-03:00`,
            status: estado,
            siteId: sede,
          },
        })
        .catch((error: unknown) => {
          if (error instanceof RespuestaModuloError && error.estadoOrigen === 400) {
            throw solicitudInvalida('La Tienda rechazó la consulta (cursor o filtro inválido)');
          }
          throw error;
        }),
      this.sedes(),
    ]);
    return aPaginaCompras(ordenes, sedes);
  }

  /** Una compra propia. Inexistente o de otro alumno, la Tienda responde 404. */
  async compra(orderId: string): Promise<CompraDetalle> {
    const [orden, sedes] = await Promise.all([
      this.gateway.get('TIENDA', `/orders/${encodeURIComponent(orderId)}`).catch((error) => {
        if (error instanceof RespuestaModuloError && error.estadoOrigen === 404) {
          throw new ProblemaError(404, 'COMPRA_NO_ENCONTRADA', 'La compra no existe', {
            modulo: 'TIENDA',
          });
        }
        throw error;
      }),
      this.sedes(),
    ]);
    return aCompraDetalle(orden, sedes);
  }
}
