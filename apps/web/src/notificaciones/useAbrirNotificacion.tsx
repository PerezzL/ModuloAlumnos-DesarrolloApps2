import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAvisar } from '@/componentes/Avisos';
import { type Notificacion, useMarcarLeida } from '@/core/notificaciones';
import { ConfirmarSalida } from './ConfirmarSalida';
import { type Destino, destinoDe } from './destino';

/**
 * Tocar una notificación: la marca como leída y lleva al destino de su `actionUrl`. Una ruta
 * propia navega; un portal externo pide confirmación; sin destino válido, solo la marca.
 */
export function useAbrirNotificacion(alNavegar?: () => void) {
  const navigate = useNavigate();
  const avisar = useAvisar();
  const marcar = useMarcarLeida();
  const [salida, setSalida] = useState<Extract<Destino, { tipo: 'externo' }> | null>(null);

  const abrir = (n: Notificacion) => {
    if (!n.leida) {
      marcar.mutate(n, {
        onError: () =>
          avisar({
            tono: 'error',
            titulo: 'No pudimos marcarla como leída',
            mensaje: 'Probá de nuevo en unos minutos.',
          }),
      });
    }
    const destino = destinoDe(n.tipo, n.actionUrl);
    if (destino?.tipo === 'interno') {
      alNavegar?.();
      navigate(destino.ruta);
    } else if (destino?.tipo === 'externo') {
      setSalida(destino);
    }
  };

  const dialogo = salida && <ConfirmarSalida destino={salida} cerrar={() => setSalida(null)} />;
  return { abrir, dialogo };
}
