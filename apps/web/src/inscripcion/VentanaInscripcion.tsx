import type { OfertaInscripcion } from '@uadenet/api-types';
import { CalendarCheck } from 'lucide-react';

const fecha = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'America/Argentina/Buenos_Aires',
});

export const formatearInstante = (instante?: string) =>
  instante ? fecha.format(new Date(instante)) : null;

/** Inscripción abierta y hasta cuándo. Cerrada, la pantalla es InscripcionCerrada. */
export function VentanaInscripcion({ oferta }: { oferta: OfertaInscripcion }) {
  const hasta = formatearInstante(oferta.inscripcionHasta);

  return (
    <div
      role="status"
      className="flex gap-2 rounded-item border border-exito/30 bg-exito-fondo p-3 text-sm"
    >
      <CalendarCheck className="mt-0.5 size-4 shrink-0 text-exito" aria-hidden />
      <div>
        <p className="font-semibold">La inscripción está abierta</p>
        {hasta && <p className="text-etiqueta">Podés inscribirte hasta el {hasta}.</p>}
      </div>
    </div>
  );
}
