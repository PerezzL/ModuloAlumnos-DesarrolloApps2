import { ArrowRight, CalendarCheck } from 'lucide-react';
import { Link } from 'react-router';
import { useOferta } from './consultas';
import { formatearInstante } from './VentanaInscripcion';

/**
 * Aviso del Inicio: la inscripción del período vigente está abierta. Cerrada, mientras carga o
 * si la oferta no responde, no se muestra.
 */
export function AvisoInscripcion() {
  const { data: oferta } = useOferta();
  if (!oferta?.inscripcionAbierta) return null;

  const hasta = formatearInstante(oferta.inscripcionHasta);

  return (
    <div
      role="status"
      aria-label="Inscripción a materias"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-campo border border-exito/30 bg-exito-fondo p-4 text-sm"
    >
      <CalendarCheck className="size-5 shrink-0 text-exito" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">La inscripción del {oferta.periodo.nombre} está abierta</p>
        <p className="text-etiqueta">
          {hasta ? `Podés inscribirte hasta el ${hasta}.` : 'Ya podés inscribirte a materias.'}
        </p>
      </div>
      <Link
        to="/academico"
        className="flex items-center gap-1 font-medium text-primario hover:underline"
      >
        Inscribirme
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}
