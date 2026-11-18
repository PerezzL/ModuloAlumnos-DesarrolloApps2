/**
 * El navegador solo conoce la URL del Gateway de CORE (AGENTS.md). Auth, notificaciones y
 * saldo van directo a CORE; los endpoints propios, al BFF por /api/v1/student.
 */
const gateway = import.meta.env.VITE_GATEWAY_URL;
if (!gateway) throw new Error('Falta VITE_GATEWAY_URL');
const gatewayUrl = gateway.replace(/\/$/, '');

/**
 * Base de login, refresh y logout. Con `VITE_AUTH_PROXY=true` es el propio origen del portal: el
 * hosting reenvía `/api/v1/auth/*` a CORE y la cookie de refresh (`SameSite=Lax`) queda en el
 * dominio del portal. Si no, el Gateway.
 */
export function baseAuth(urlGateway: string, proxy: string | undefined): string {
  return proxy === 'true' ? '' : urlGateway;
}

export const config = {
  gatewayUrl,
  bffUrl: `${gatewayUrl}/api/v1/student`,
  authUrl: baseAuth(gatewayUrl, import.meta.env.VITE_AUTH_PROXY),
  notificacionesUrl: import.meta.env.VITE_NOTIFICATIONS_URL,
  /** Portales a los que se sale desde una notificación. Sin valor, no se navega. */
  portales: {
    biblioteca: import.meta.env.VITE_BIBLIOTECA_URL || undefined,
    eventos: import.meta.env.VITE_EVENTOS_URL || undefined,
  },
};
