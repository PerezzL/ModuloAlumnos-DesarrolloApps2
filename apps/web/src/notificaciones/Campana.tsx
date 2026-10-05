import { Bell } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/componentes/ui/button';
import { useNoLeidas } from '@/core/notificaciones';
import { ListaNotificaciones } from './ListaNotificaciones';

/** Campana de la barra superior: contador de no leídas y panel con las últimas. */
export function Campana() {
  const [abierto, setAbierto] = useState(false);
  const { data: noLeidas } = useNoLeidas();
  const contenedor = useRef<HTMLDivElement>(null);
  const idPanel = useId();
  const cantidad = noLeidas ?? 0;

  useEffect(() => {
    if (!abierto) return;
    const alClic = (e: MouseEvent) => {
      // Un clic dentro de un diálogo (confirmar salida) no cierra el panel
      const objetivo = e.target as Element;
      if (!contenedor.current?.contains(objetivo) && !objetivo.closest('dialog')) {
        setAbierto(false);
      }
    };
    const alTecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', alClic);
    document.addEventListener('keydown', alTecla);
    return () => {
      document.removeEventListener('mousedown', alClic);
      document.removeEventListener('keydown', alTecla);
    };
  }, [abierto]);

  return (
    <div ref={contenedor} className="relative">
      <Button
        variant="fantasma"
        size="icono"
        aria-label={cantidad > 0 ? `Notificaciones, ${cantidad} sin leer` : 'Notificaciones'}
        aria-expanded={abierto}
        aria-controls={idPanel}
        onClick={() => setAbierto((a) => !a)}
        className="relative"
      >
        <Bell className="size-[18px]" aria-hidden />
        {cantidad > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-peligro px-1 text-[10px] font-bold text-white"
          >
            {cantidad > 99 ? '99+' : cantidad}
          </span>
        )}
      </Button>
      {abierto && (
        <div
          id={idPanel}
          role="region"
          aria-label="Panel de notificaciones"
          className="absolute right-0 z-40 mt-2 flex max-h-[min(560px,80vh)] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-campo border border-borde-suave bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-borde-suave px-4 py-3">
            <p className="font-semibold">Notificaciones</p>
            <Link
              to="/notificaciones"
              onClick={() => setAbierto(false)}
              className="text-sm font-medium text-primario hover:underline"
            >
              Ver todas
            </Link>
          </div>
          <div className="overflow-y-auto p-2">
            <ListaNotificaciones alNavegar={() => setAbierto(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
