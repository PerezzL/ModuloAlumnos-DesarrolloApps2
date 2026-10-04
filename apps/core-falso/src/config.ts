export interface ConfigCore {
  puerto: number;
  issuer: string;
  audience: string;
  /** Vida del access token en segundos (900 en CORE; se puede bajar para probar el refresh) */
  accessTtlS: number;
  /** Adónde reenvía el Gateway /api/v1/student/*, con la base incluida: el BFF o Prism */
  studentServiceUrl: string;
  webOrigin: string;
  /** Cookie de refresh con Secure: true en producción; en http://localhost Safari la rechaza */
  cookieSecure: boolean;
  timeoutGatewayMs: number;
}

export function cargarConfig(env: NodeJS.ProcessEnv = process.env): ConfigCore {
  const puerto = Number(env.CORE_PORT ?? 4000);
  return {
    puerto,
    issuer: env.JWT_ISSUER ?? `http://localhost:${puerto}`,
    audience: env.JWT_AUDIENCE ?? 'uadenet',
    accessTtlS: Number(env.CORE_ACCESS_TTL_S ?? 900),
    studentServiceUrl: env.STUDENT_SERVICE_URL ?? 'http://localhost:3000/api/v1',
    webOrigin: env.WEB_ORIGIN ?? 'http://localhost:5173',
    cookieSecure: env.CORE_COOKIE_SECURE === 'true',
    timeoutGatewayMs: Number(env.CORE_GATEWAY_TIMEOUT_MS ?? 10_000),
  };
}
