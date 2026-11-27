import { Injectable } from '@nestjs/common';
import type { ListaSedes } from '@uadenet/api-types';
import type { Alumno } from '../../auth/alumno.decorator';
import { CacheTtl } from '../../comun/cache';
import { RespuestaModuloError } from '../../gateway/pedido';
import { BackofficeInternoClient } from './backoffice.interno';
import {
  aFicha,
  aListaSedes,
  aNombreCompleto,
  aSedes,
  fichaSoloIdentidad,
} from './backoffice.mapper';
import type { FichaAlumno } from './backoffice.modelo';

/** Las sedes casi no cambian y Backoffice no publica evento de sedes: se consultan y cachean. */
const TTL_SEDES_MS = 60 * 60 * 1000;
/** El nombre de una persona casi no cambia: se cachea, igual que las sedes */
const TTL_NOMBRES_MS = 60 * 60 * 1000;
/** Tope de páginas de 100 sedes: corta un cursor que nunca termina */
const MAX_PAGINAS_SEDES = 10;

/**
 * Módulo 8 · Backoffice. Único lugar que conoce la forma de sus respuestas. Lee las rutas
 * internas (`/internal/v1/*`) con el token de servicio: Backoffice no le da al alumno permiso
 * de lectura por el Gateway (docs/integraciones.md).
 */
@Injectable()
export class BackofficeAdapter {
  // Una sola entrada con el catálogo completo: un llamado (o pocos) en lugar de uno por sede
  private readonly catalogoSedes = new CacheTtl<ReadonlyMap<string, string>>(TTL_SEDES_MS);
  private readonly nombres = new CacheTtl<string | null>(TTL_NOMBRES_MS);

  constructor(private readonly backoffice: BackofficeInternoClient) {}

  async ficha(alumno: Alumno): Promise<FichaAlumno> {
    try {
      // El id sale siempre del token (X-User-Id): cada alumno ve solo su ficha
      const usuario = await this.backoffice.get(`/users/${encodeURIComponent(alumno.id)}`);
      return aFicha(alumno, usuario);
    } catch (error) {
      if (error instanceof RespuestaModuloError && error.estadoOrigen === 404) {
        return fichaSoloIdentidad(alumno);
      }
      throw error;
    }
  }

  /**
   * Nombre y apellido de cualquier usuario (por ejemplo, el docente que cargó una nota), o
   * null si Backoffice no lo conoce o no tiene nombre. Si Backoffice falla, lanza y no se
   * cachea: el llamador decide si sigue sin el nombre.
   */
  nombreDeUsuario(userId: string): Promise<string | null> {
    return this.nombres.obtener(userId, async () => {
      try {
        return aNombreCompleto(await this.backoffice.get(`/users/${encodeURIComponent(userId)}`));
      } catch (error) {
        if (error instanceof RespuestaModuloError && error.estadoOrigen === 404) return null;
        throw error;
      }
    });
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
          await this.backoffice.get('/sites', {
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

  /** Todas las sedes, por nombre, del mismo catálogo cacheado. Si Backoffice falla, lanza. */
  async sedes(): Promise<ListaSedes> {
    return aListaSedes(await this.nombresDeSedes());
  }
}
