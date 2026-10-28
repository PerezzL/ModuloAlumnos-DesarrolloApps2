import type { OfertaInscripcion } from '@uadenet/api-types';
import { CalendarX } from 'lucide-react';
import { useState } from 'react';
import { EstadoVacio } from '@/componentes/EstadoVacio';
import { formatearInstante } from './VentanaInscripcion';

/** Cuándo abre (o cuándo cerró) la inscripción del período, según sus fechas. */
function cuando(oferta: OfertaInscripcion, ahora: number) {
  const { periodo, inscripcionDesde, inscripcionHasta } = oferta;
  const desde = formatearInstante(inscripcionDesde);
  const hasta = formatearInstante(inscripcionHasta);
  if (inscripcionDesde && Date.parse(inscripcionDesde) > ahora) {
    return hasta
      ? `La inscripción del ${periodo.nombre} abre el ${desde} y cierra el ${hasta}.`
      : `La inscripción del ${periodo.nombre} abre el ${desde}.`;
  }
  if (inscripcionHasta && Date.parse(inscripcionHasta) <= ahora) {
    return `La inscripción del ${periodo.nombre} cerró el ${hasta}.`;
  }
  return `Todavía no hay fechas de inscripción para el ${periodo.nombre}.`;
}

/** Inscripción cerrada: en lugar de la oferta, cuándo abre o cuándo cerró. */
export function InscripcionCerrada({ oferta }: { oferta: OfertaInscripcion }) {
  const [ahora] = useState(() => Date.now());
  return (
    <div role="status" className="rounded-campo border border-borde-suave bg-white">
      <EstadoVacio
        icono={CalendarX}
        titulo="El período de inscripción no está abierto"
        mensaje={cuando(oferta, ahora)}
      />
    </div>
  );
}
