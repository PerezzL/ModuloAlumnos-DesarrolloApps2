/** Variables de entorno válidas para los tests e2e. */
export const envDePrueba = {
  GATEWAY_URL: 'http://gateway.test',
  GATEWAY_TIMEOUT_MS: '200',
  JWKS_URL: 'http://gateway.test/.well-known/jwks.json',
  CORE_SIGNATURE_SECRET: 'secreto-de-prueba',
  JWT_ISSUER: 'http://gateway.test',
  JWT_AUDIENCE: 'uadenet',
  PREFIJO_DOCENTE: '/api/v1/teacher',
  PREFIJO_COMEDOR: '/api/v1/dining',
  PREFIJO_TIENDA: '/api/v1/store',
  PREFIJO_EVENTOS: '/api/v1/events',
  SERVICE_TOKEN_URL: 'http://gateway.test/internal/v1/service-auth/token',
  SERVICE_CLIENT_ID: 'student-service',
  SERVICE_CLIENT_SECRET: 'secreto-de-servicio-de-prueba',
  BACKOFFICE_INTERNAL_URL: 'http://backoffice.test/internal/v1',
  PREFIJO_ACADEMICO: '/api/v1/academic',
  LOG_LEVEL: 'silent',
};

export function aplicarEnvDePrueba() {
  Object.assign(process.env, envDePrueba);
}
