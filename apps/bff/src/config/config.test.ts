import { describe, expect, it } from 'vitest';
import { cargarConfig } from './config';

const completa = {
  GATEWAY_URL: 'http://localhost:4000',
  JWKS_URL: 'http://localhost:4000/.well-known/jwks.json',
  JWT_ISSUER: 'http://localhost:4000',
  JWT_AUDIENCE: 'uadenet',
  PREFIJO_DOCENTE: '/api/v1/teacher',
  PREFIJO_COMEDOR: '/api/v1/dining',
  PREFIJO_TIENDA: '/api/v1/store',
  PREFIJO_EVENTOS: '/api/v1/events',
  PREFIJO_BACKOFFICE: '/api/v1/backoffice',
  PREFIJO_ACADEMICO: '/api/v1/academic',
};

describe('cargarConfig', () => {
  it('aplica los valores por defecto', () => {
    const config = cargarConfig(completa);
    expect(config.BFF_PORT).toBe(3000);
    expect(config.GATEWAY_TIMEOUT_MS).toBe(8_000);
  });

  it('nombra todas las variables que faltan', () => {
    const { GATEWAY_URL: _g, JWKS_URL: _j, ...incompleta } = completa;
    expect(() => cargarConfig(incompleta)).toThrow(/GATEWAY_URL[\s\S]*JWKS_URL/);
  });

  it('rechaza un prefijo sin barra inicial', () => {
    expect(() => cargarConfig({ ...completa, PREFIJO_TIENDA: 'store' })).toThrow(/PREFIJO_TIENDA/);
  });
});
