import type { Asistencia, EstadoCursada } from '@uadenet/api-types';
import { CircleSlash, ShieldAlert, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Desde cuántas faltas restantes se muestra la alerta. Las tarjetas no fijan un número. */
export const UMBRAL_ALERTA_FALTAS = 1;

const faltas = (n: number) => (n === 1 ? '1 falta' : `${n} faltas`);

/**
 * Cuántas faltas le quedan antes de quedar libre (H18). Si el módulo dueño no informa el
 * límite, no se muestra nada: el portal no inventa el número. Si la situación ya es `LIBRE`
 * (Módulo 9), se muestra eso en lugar del indicador.
 */
export function IndicadorFaltas({
  estado,
  asistencia,
}: {
  estado: EstadoCursada;
  asistencia: Asistencia;
}) {
  if (estado === 'LIBRE') {
    return (
      <Caja tono="peligro" icono={CircleSlash} titulo="Quedaste libre en esta materia">
        Así figura tu situación en Gestión Académica.
      </Caja>
    );
  }

  const { limiteInasistencias: limite, inasistenciasRestantes: restantes } = asistencia;
  if (limite == null || restantes == null) return null;

  const quedan = Math.max(restantes, 0);
  const alerta = quedan <= UMBRAL_ALERTA_FALTAS;
  return (
    <Caja
      tono={alerta ? 'aviso' : 'neutro'}
      icono={alerta ? ShieldAlert : ShieldCheck}
      titulo={
        quedan === 0
          ? 'No te quedan faltas disponibles'
          : `Te ${quedan === 1 ? 'queda' : 'quedan'} ${faltas(quedan)} antes de quedar libre`
      }
    >
      El límite es de {faltas(limite)}.
    </Caja>
  );
}

const TONOS = {
  neutro: 'border-borde-suave bg-fondo text-etiqueta',
  aviso: 'border-aviso/30 bg-aviso-fondo text-aviso-texto',
  peligro: 'border-peligro/20 bg-peligro-fondo text-peligro-texto',
};

function Caja({
  tono,
  icono: Icono,
  titulo,
  children,
}: {
  tono: keyof typeof TONOS;
  icono: typeof ShieldAlert;
  titulo: string;
  children: string | string[];
}) {
  return (
    <div
      role={tono === 'neutro' ? 'status' : 'alert'}
      aria-label="Faltas"
      className={cn('flex items-start gap-3 rounded-item border p-3', TONOS[tono])}
    >
      <Icono className="size-5 shrink-0" aria-hidden />
      <div className="text-sm">
        <p className="font-semibold">{titulo}</p>
        <p className="opacity-80">{children}</p>
      </div>
    </div>
  );
}
