import type { Asistencia, EstadoCursada } from '@uadenet/api-types';
import { CircleSlash, ShieldAlert, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatearPorcentaje } from './formato';

/**
 * A cuántos puntos del mínimo se muestra la alerta. El Módulo 2 informa el porcentaje y el
 * mínimo, no cuántas faltas quedan (no se conoce el total de clases del curso).
 */
export const MARGEN_ALERTA_PUNTOS = 5;

/**
 * Condición por asistencia (H18): el porcentaje contra el mínimo para quedar regular, tal como
 * los informa el Módulo 2. El portal no calcula la condición. Si la situación de la materia ya
 * es `LIBRE` (Módulo 9), se muestra eso.
 */
export function IndicadorCondicion({
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

  const { porcentaje, porcentajeMinimo: minimo, condicion } = asistencia;
  const detalle = `Tenés ${formatearPorcentaje(porcentaje)} de asistencia; el mínimo para quedar regular es ${formatearPorcentaje(minimo)}.`;
  if (condicion === 'LIBRE') {
    return (
      <Caja tono="peligro" icono={CircleSlash} titulo="Quedaste libre por asistencia">
        {detalle}
      </Caja>
    );
  }

  const alerta = porcentaje - minimo < MARGEN_ALERTA_PUNTOS;
  return (
    <Caja
      tono={alerta ? 'aviso' : 'neutro'}
      icono={alerta ? ShieldAlert : ShieldCheck}
      titulo={alerta ? 'Estás cerca del mínimo de asistencia' : 'Tu asistencia está al día'}
    >
      {detalle}
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
  children: string;
}) {
  return (
    <div
      role={tono === 'neutro' ? 'status' : 'alert'}
      aria-label="Condición por asistencia"
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
