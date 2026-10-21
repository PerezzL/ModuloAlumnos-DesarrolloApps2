import { Injectable } from '@nestjs/common';
import type { Perfil } from '@uadenet/api-types';
import type { Alumno } from '../../auth/alumno.decorator';
import { CacheTtl } from '../../comun/cache';
import { GatewayClient, RespuestaModuloError } from '../../gateway/gateway.client';
import { aPerfil, aSedes, perfilSoloIdentidad } from './backoffice.mapper';

/** Las sedes casi no cambian y Backoffice no publica evento de sedes: se consultan y cachean. */
const TTL_SEDES_MS = 60 * 60 * 1000;
/** Tope de páginas de 100 sedes: corta un cursor que nunca termina */
const MAX_PAGINAS_SEDES = 10;

/** Módulo 8 · Backoffice. Único lugar que conoce la forma de sus respuestas. */
@Injectable()
export class BackofficeAdapter {
  // Una sola entrada con el catálogo completo: un llamado (o pocos) en lugar de uno por sede
  private readonly catalogoSedes = new CacheTtl<ReadonlyMap<string, string>>(TTL_SEDES_MS);

  constructor(private readonly gateway: GatewayClient) {}

  async perfil(alumno: Alumno): Promise<Perfil> {
    try {
      const usuario = await this.gateway.get(
        'BACKOFFICE',
        `/users/${encodeURIComponent(alumno.id)}`,
      );
      return aPerfil(alumno, usuario);
    } catch (error) {
      if (error instanceof RespuestaModuloError && error.estadoOrigen === 404) {
        return perfilSoloIdentidad(alumno);
      }
      throw error;
    }
  }

  /** Plan de estudios del alumno, o null si Backoffice no lo informa. */
  async planId(alumno: Alumno): Promise<string | null> {
    return (await this.perfil(alumno)).planId ?? null;
  }

  /**
   * Nombre de cada sede por `siteId`, para cualquier módulo que mande solo el id. Incluye
   * las inactivas. Si Backoffice falla, lanza y no se cachea: cada llamador decide si sigue
   * sin el nombre.
   */
  nombresDeSedes(): Promise<ReadonlyMap<string, string>> {
    return this.catalogoSedes.obtener('todas', async () => {
      const nombres = new Map<string, string>();
      let cursor: string | null = null;
      for (let pagina = 0; pagina < MAX_PAGINAS_SEDES; pagina++) {
        const respuesta = aSedes(
          await this.gateway.get('BACKOFFICE', '/sites', {
            query: { limit: 100, cursor: cursor ?? undefined },
          }),
        );
        respuesta.nombres.forEach((nombre, siteId) => nombres.set(siteId, nombre));
        cursor = respuesta.nextCursor;
        if (!cursor) break;
      }
      return nombres;
    });
  }
}
