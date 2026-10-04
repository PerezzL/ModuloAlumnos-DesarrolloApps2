import type { Comision } from '@uadenet/api-types';
import { CircleCheck, CircleSlash, Lock, UserPlus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const ESTADOS: Record<Comision['estado'], { texto: string; icono: LucideIcon; clase: string }> = {
  INSCRIPTO: { texto: 'Inscripto', icono: CircleCheck, clase: 'bg-exito-fondo text-exito' },
  CON_CUPO: { texto: 'Con cupo', icono: UserPlus, clase: 'bg-primario/10 text-primario-oscuro' },
  SIN_CUPO: { texto: 'Sin cupo', icono: CircleSlash, clase: 'bg-peligro-fondo text-peligro-texto' },
  BLOQUEADA: { texto: 'Bloqueada', icono: Lock, clase: 'bg-fondo text-etiqueta' },
};

/** Estado de la comisión con texto e ícono: no depende solo del color. */
export function EstadoComision({ estado }: { estado: Comision['estado'] }) {
  const { texto, icono: Icono, clase } = ESTADOS[estado];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        clase,
      )}
    >
      <Icono className="size-3.5" aria-hidden />
      {texto}
    </span>
  );
}
