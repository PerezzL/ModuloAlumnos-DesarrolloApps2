import { Injectable } from '@nestjs/common';
import type { Perfil } from '@uadenet/api-types';
import type { Alumno } from '../../auth/alumno.decorator';
import { GatewayClient, RespuestaModuloError } from '../../gateway/gateway.client';
import { aPerfil, perfilSoloIdentidad } from './backoffice.mapper';

/** Módulo 8 · Backoffice. Único lugar que conoce la forma de sus respuestas. */
@Injectable()
export class BackofficeAdapter {
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
}
