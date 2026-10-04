import { ExternalLink } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/componentes/ui/button';
import type { Destino } from './destino';

type Externo = Extract<Destino, { tipo: 'externo' }>;

/**
 * Aviso antes de salir a otro portal: no hay sesión compartida, así que puede pedir que el
 * alumno vuelva a ingresar. Se abre en otra pestaña para no perder el portal.
 */
export function ConfirmarSalida({ destino, cerrar }: { destino: Externo; cerrar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);

  // Se abre como modal (foco atrapado, Escape cierra). Sin cleanup que lo cierre: en
  // StrictMode el efecto corre dos veces y cerrarlo dispararía `onClose`.
  useEffect(() => {
    const d = dialogo.current;
    if (!d || d.open) return;
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  }, []);

  const ir = () => {
    window.open(destino.url, '_blank', 'noopener,noreferrer');
    cerrar();
  };

  // En un portal: si quedara dentro del panel de la campana, su overflow lo recortaría
  return createPortal(
    <dialog
      ref={dialogo}
      aria-labelledby="titulo-salida"
      onClose={cerrar}
      onCancel={cerrar}
      className="m-auto w-[min(420px,calc(100vw-2rem))] rounded-campo border border-borde-suave bg-white p-6 text-texto shadow-xl backdrop:bg-uade-navy/40"
    >
      <h2 id="titulo-salida" className="text-lg font-semibold">
        Vas a salir al portal de {destino.portal}
      </h2>
      <p className="pt-2 text-sm text-texto-suave">
        Se abre en otra pestaña. Es otro sistema y no comparte tu sesión: puede que tengas que
        volver a ingresar.
      </p>
      <div className="flex justify-end gap-2 pt-5">
        <Button variant="fantasma" onClick={cerrar}>
          Cancelar
        </Button>
        <Button onClick={ir}>
          Ir a {destino.portal}
          <ExternalLink className="size-4" aria-hidden />
        </Button>
      </div>
    </dialog>,
    document.body,
  );
}
