import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAvisar } from '@/componentes/Avisos';
import { config } from '@/config';
import {
  aNotificacion,
  type NotificacionCore,
  recibirNotificacion,
  resincronizar,
} from '@/core/notificaciones';
import { useSesion } from '@/sesion/SesionProvider';

/** Intentos seguidos de renovar la sesión cuando CORE rechaza el token del socket */
const MAX_RENOVACIONES = 2;

/**
 * Notificaciones en tiempo real por el namespace `/notifications` de CORE (sección 8.3).
 * El socket es una aceleración, no una garantía: al conectar y al reconectar se vuelve a
 * pedir listado y contador por REST. Se abre con la sesión y se cierra con ella (el layout
 * autenticado se desmonta al cerrar sesión). El BFF no interviene.
 */
export function useNotificacionesEnVivo() {
  const { sesion } = useSesion();
  const queryClient = useQueryClient();
  const avisar = useAvisar();

  useEffect(() => {
    if (!config.notificacionesUrl) return;
    let renovaciones = 0;
    const socket = io(config.notificacionesUrl, {
      // Se evalúa en cada (re)conexión: siempre va el token vigente
      auth: (cb) => cb({ token: sesion.token() }),
    });

    socket.on('connect', () => {
      renovaciones = 0;
      void resincronizar(queryClient);
    });

    socket.on('notification.created', (crudo: NotificacionCore) => {
      const n = aNotificacion(crudo);
      if (recibirNotificacion(queryClient, n)) {
        avisar({ titulo: n.titulo || 'Nueva notificación', mensaje: n.mensaje });
      }
    });

    // Si CORE rechazó el handshake (token vencido) socket.io no reintenta solo: se renueva la
    // sesión (refresh serializado) y se vuelve a conectar. Las caídas de red sí las reintenta.
    socket.on('connect_error', () => {
      if (socket.active || renovaciones >= MAX_RENOVACIONES) return;
      renovaciones++;
      void sesion.refrescar().then((token) => {
        if (token) socket.connect();
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [sesion, queryClient, avisar]);
}
