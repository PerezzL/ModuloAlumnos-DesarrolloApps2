/**
 * El navegador solo conoce la URL del Gateway de CORE (AGENTS.md). Auth, notificaciones y
 * saldo van directo a CORE; los endpoints propios, al BFF por /api/v1/student.
 */
const gateway = import.meta.env.VITE_GATEWAY_URL;
if (!gateway) throw new Error('Falta VITE_GATEWAY_URL');

export const config = {
  gatewayUrl: gateway.replace(/\/$/, ''),
  bffUrl: `${gateway.replace(/\/$/, '')}/api/v1/student`,
  notificacionesUrl: import.meta.env.VITE_NOTIFICATIONS_URL,
  /** Portales a los que se sale desde una notificación. Sin valor, no se navega. */
  portales: {
    biblioteca: import.meta.env.VITE_BIBLIOTECA_URL || undefined,
    eventos: import.meta.env.VITE_EVENTOS_URL || undefined,
  },
};
