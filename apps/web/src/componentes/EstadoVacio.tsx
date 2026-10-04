import { Inbox, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Estado vacío común: explica por qué no hay datos. Cada pantalla pasa su propio mensaje.
 * Nunca se usa para un error (eso es ErrorCarga): vacío y error no se muestran igual.
 */
export function EstadoVacio({
  titulo,
  mensaje,
  icono: Icono = Inbox,
  children,
  className,
}: {
  titulo: string;
  mensaje?: string;
  icono?: LucideIcon;
  /** Acción opcional, por ejemplo un enlace */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-4 py-10 text-center',
        className,
      )}
    >
      <Icono className="size-8 text-pista" aria-hidden />
      <p className="font-semibold">{titulo}</p>
      {mensaje && <p className="max-w-sm text-sm text-texto-suave">{mensaje}</p>}
      {children}
    </div>
  );
}
