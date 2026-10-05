import type { OfertaInscripcion } from '@uadenet/api-types';
import { CalendarCheck, CalendarX } from 'lucide-react';
import { cn } from '@/lib/utils';

const fecha = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'America/Argentina/Buenos_Aires',
});

const formatear = (instante?: string) => (instante ? fecha.format(new Date(instante)) : null);

/** Si la inscripción está abierta y hasta cuándo. Cerrada, la oferta se ve pero no se inscribe. */
export function VentanaInscripcion({ oferta }: { oferta: OfertaInscripcion }) {
  const desde = formatear(oferta.inscripcionDesde);
  const hasta = formatear(oferta.inscripcionHasta);
  const abierta = oferta.inscripcionAbierta;
  const Icono = abierta ? CalendarCheck : CalendarX;

  return (
    <div
      role="status"
      className={cn(
        'flex gap-2 rounded-item border p-3 text-sm',
        abierta ? 'border-exito/30 bg-exito-fondo' : 'border-aviso/30 bg-aviso-fondo',
      )}
    >
      <Icono
        className={cn('mt-0.5 size-4 shrink-0', abierta ? 'text-exito' : 'text-aviso')}
        aria-hidden
      />
      <div>
        <p className="font-semibold">
          {abierta ? 'La inscripción está abierta' : 'La inscripción está cerrada'}
        </p>
        <p className="text-etiqueta">
          {abierta
            ? hasta && `Podés inscribirte hasta el ${hasta}.`
            : desde && hasta
              ? `El período de inscripción es del ${desde} al ${hasta}. Podés ver la oferta, pero no inscribirte.`
              : 'Podés ver la oferta, pero no inscribirte.'}
        </p>
      </div>
    </div>
  );
}
