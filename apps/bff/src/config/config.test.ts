import { describe, expect, it } from 'vitest';
import { cargarConfig } from './config';

const completa = {
  GATEWAY_URL: 'http://localhost:4000',
  JWKS_URL: 'http://localhost:4000/.well-known/jwks.json',
  JWT_ISSUER: 'http://localhost:4000',
  JWT_AUDIENCE: 'uadenet',
  CORE_SIGNATURE_SECRET: 'secreto',
  PREFIJO_DOCENTE: '/api/v1/teacher',
  PREFIJO_COMEDOR: '/api/v1/dining',
  PREFIJO_TIENDA: '/api/v1/store',
  PREFIJO_EVENTOS: '/api/v1/events',
  SERVICE_TOKEN_URL: 'http://localhost:4000/internal/v1/service-auth/token',
  SERVICE_CLIENT_ID: 'student-service',
  SERVICE_CLIENT_SECRET: 'secreto',
  BACKOFFICE_INTERNAL_URL: 'http://localhost:4000/backoffice/internal/v1',
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

  it('sin el secreto de la firma del Gateway no arranca', () => {
    const { CORE_SIGNATURE_SECRET: _s, ...sinSecreto } = completa;
    expect(() => cargarConfig(sinSecreto)).toThrow(/CORE_SIGNATURE_SECRET/);
    expect(() => cargarConfig({ ...completa, CORE_SIGNATURE_SECRET: '' })).toThrow(
      /CORE_SIGNATURE_SECRET/,
    );
  });

  it('rechaza un prefijo sin barra inicial', () => {
    expect(() => cargarConfig({ ...completa, PREFIJO_TIENDA: 'store' })).toThrow(/PREFIJO_TIENDA/);
  });

  it('sin las credenciales del token de servicio no arranca', () => {
    const { SERVICE_CLIENT_SECRET: _s, BACKOFFICE_INTERNAL_URL: _b, ...sinServicio } = completa;
    expect(() => cargarConfig(sinServicio)).toThrow(
      /SERVICE_CLIENT_SECRET[\s\S]*BACKOFFICE_INTERNAL_URL/,
    );
  });
});
