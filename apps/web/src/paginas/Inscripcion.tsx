import type { Comision, MateriaOferta } from '@uadenet/api-types';
import { BookX, Info, Lock } from 'lucide-react';
import { Cargando } from '@/componentes/Cargando';
import { ErrorCarga } from '@/componentes/ErrorCarga';
import { EstadoVacio } from '@/componentes/EstadoVacio';
import { useOferta } from '@/inscripcion/consultas';
import { EstadoComision } from '@/inscripcion/EstadoComision';
import { VentanaInscripcion } from '@/inscripcion/VentanaInscripcion';

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

      <VentanaInscripcion oferta={data} />

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
      {materia.bloqueada && <CorrelativasFaltantes materia={materia} />}
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
      <EstadoComision estado={comision.estado} />
    </li>
  );
}

const QUE_FALTA = { APROBADA: 'aprobar', REGULAR: 'regularizar' } as const;

function CorrelativasFaltantes({ materia }: { materia: MateriaOferta }) {
  const faltantes = materia.correlativasFaltantes ?? [];
  return (
    <div className="mt-2 flex gap-2 rounded-item bg-fondo p-3 text-sm text-etiqueta">
      <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-medium">Todavía no podés cursarla.</p>
        {faltantes.length > 0 && (
          <ul aria-label="Correlativas que te faltan" className="list-disc pl-4">
            {faltantes.map((c) => (
              <li key={c.asignaturaId}>
                Te falta {QUE_FALTA[c.tipo]} {c.nombre}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
