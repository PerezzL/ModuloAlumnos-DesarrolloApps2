/** Módulos detrás del Gateway, con el prefijo externo de la sección 6 de CORE_INTEGRACION.md. */
export const MODULOS = {
  student: '/api/v1/student',
  teacher: '/api/v1/teacher',
  dining: '/api/v1/dining',
  store: '/api/v1/store',
  events: '/api/v1/events',
  backoffice: '/api/v1/backoffice',
  academic: '/api/v1/academic',
} as const;

export type Modulo = keyof typeof MODULOS;
export const esModulo = (nombre: string): nombre is Modulo => Object.hasOwn(MODULOS, nombre);

export interface ConfigCore {
  puerto: number;
  issuer: string;
  audience: string;
  /** Vida del access token en segundos (900 en CORE; se puede bajar para probar el refresh) */
  accessTtlS: number;
  /** Adónde reenvía el Gateway /api/v1/student/*, con la base incluida: el BFF o Prism */
  studentServiceUrl: string;
  /**
   * Destino real de los demás módulos (`DINING_SERVICE_URL`, etc.), con la base incluida.
   * Sin valor, responde el módulo falso desde las fixtures.
   */
  servicios: Partial<Record<Exclude<Modulo, 'student'>, string>>;
  /** Fallas simuladas al arrancar: `dining:caido,events:lento:3000,academic:invalido` */
  fallas: string;
  webOrigin: string;
  /** Cookie de refresh con Secure: true en producción; en http://localhost Safari la rechaza */
  cookieSecure: boolean;
  timeoutGatewayMs: number;
  /** Secreto de la firma `X-Core-Signature` de los pedidos que el Gateway reenvía. Solo de desarrollo */
  secretoFirma: string;
}

export function cargarConfig(env: NodeJS.ProcessEnv = process.env): ConfigCore {
  const puerto = Number(env.CORE_PORT ?? 4000);
  const servicio = (nombre: string) => env[`${nombre}_SERVICE_URL`] || undefined;
  return {
    puerto,
    issuer: env.JWT_ISSUER ?? `http://localhost:${puerto}`,
    audience: env.JWT_AUDIENCE ?? 'uadenet',
    accessTtlS: Number(env.CORE_ACCESS_TTL_S ?? 900),
    studentServiceUrl: env.STUDENT_SERVICE_URL ?? 'http://localhost:3000/api/v1',
    servicios: {
      teacher: servicio('TEACHER'),
      dining: servicio('DINING'),
      store: servicio('STORE'),
      events: servicio('EVENTS'),
      backoffice: servicio('BACKOFFICE'),
      academic: servicio('ACADEMIC'),
    },
    fallas: env.CORE_FALLAS ?? '',
    webOrigin: env.WEB_ORIGIN ?? 'http://localhost:5173',
    cookieSecure: env.CORE_COOKIE_SECURE === 'true',
    timeoutGatewayMs: Number(env.CORE_GATEWAY_TIMEOUT_MS ?? 10_000),
    secretoFirma: env.CORE_SIGNATURE_SECRET ?? 'secreto-de-desarrollo',
  };
}
