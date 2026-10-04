import type { Comision, MateriaOferta } from '@uadenet/api-types';
import { BookX, Info } from 'lucide-react';
import { Cargando } from '@/componentes/Cargando';
import { ErrorCarga } from '@/componentes/ErrorCarga';
import { EstadoVacio } from '@/componentes/EstadoVacio';
import { useOferta } from '@/inscripcion/consultas';

/** Inscripción a materias (4.3): oferta del plan agrupada por materia. */
export function Inscripcion() {
  const { data, error, isPending, refetch } = useOferta();

  if (isPending) return <Cargando texto="Cargando la oferta…" />;
  if (error) {
    return (
      <ErrorCarga error={error} fuente="La oferta de materias" reintentar={() => void refetch()} />
    );
  }

  return (
    <section className="flex max-w-5xl flex-col gap-4" aria-labelledby="titulo-oferta">
      <div>
        <h2 id="titulo-oferta" className="text-lg font-semibold">
          Oferta del {data.periodo.nombre}
        </h2>
      </div>

      {!data.filtradaPorPlan && (
        <p className="flex gap-2 rounded-item border border-borde-suave bg-white p-3 text-sm text-etiqueta">
          <Info className="mt-0.5 size-4 shrink-0 text-primario" aria-hidden />
          No pudimos confirmar tu plan de estudios, así que mostramos las comisiones de todos los
          planes. Revisá que la materia sea de tu carrera antes de inscribirte.
        </p>
      )}

      {data.materias.length === 0 ? (
        <EstadoVacio
          icono={BookX}
          titulo="No hay materias para inscribirte"
          mensaje="Tu plan no tiene materias ofrecidas en este período."
          className="rounded-campo border border-borde-suave bg-white"
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {data.materias.map((m) => (
            <Materia key={m.asignatura.id} materia={m} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Materia({ materia }: { materia: MateriaOferta }) {
  const { asignatura } = materia;
  return (
    <li className="rounded-campo border border-borde-suave bg-white p-5">
      <h3 className="font-semibold">
        {asignatura.codigo && (
          <span className="pr-2 text-sm font-medium text-texto-suave">{asignatura.codigo}</span>
        )}
        {asignatura.nombre}
      </h3>
      <ul aria-label={`Comisiones de ${asignatura.nombre}`} className="mt-3 flex flex-col gap-2">
        {materia.comisiones.map((c) => (
          <ComisionFila key={c.cursoId} comision={c} />
        ))}
      </ul>
    </li>
  );
}

function ComisionFila({ comision }: { comision: Comision }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-item border border-borde-suave p-3">
      <p className="min-w-0 flex-1 font-medium">Comisión {comision.nombre ?? comision.cursoId}</p>
      {comision.cupoMaximo !== undefined && comision.inscriptosActivos !== undefined && (
        <p className="text-sm text-texto-suave tabular-nums">
          {comision.inscriptosActivos}/{comision.cupoMaximo} inscriptos
        </p>
      )}
    </li>
  );
}
