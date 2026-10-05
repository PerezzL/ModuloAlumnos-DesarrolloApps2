import type { CursadaResumen } from '@uadenet/api-types';
import { GraduationCap } from 'lucide-react';
import { Cargando } from '@/componentes/Cargando';
import { ErrorCarga } from '@/componentes/ErrorCarga';
import { EstadoVacio } from '@/componentes/EstadoVacio';
import { useCursadas } from '@/cursadas/consultas';
import { SITUACION } from '@/cursadas/situacion';

/** Historial académico (4.4): materias cursadas con nota y situación. */
export function Historial() {
  const { data, error, isPending, refetch } = useCursadas();

  if (isPending) return <Cargando texto="Cargando tu historial…" />;
  if (error) {
    return (
      <ErrorCarga error={error} fuente="El historial académico" reintentar={() => void refetch()} />
    );
  }
  if (data.length === 0) {
    return (
      <EstadoVacio
        icono={GraduationCap}
        titulo="Todavía no cursaste materias"
        mensaje="Cuando te inscribas en una materia, la vas a ver acá."
        className="max-w-5xl rounded-campo border border-borde-suave bg-white"
      />
    );
  }

  return (
    <section
      aria-labelledby="titulo-historial"
      className="max-w-5xl rounded-campo border border-borde-suave bg-white p-6"
    >
      <h2 id="titulo-historial" className="pb-4 text-lg font-semibold">
        Historial académico
      </h2>
      <TablaCursadas cursadas={data} titulo="Historial académico" />
    </section>
  );
}

function TablaCursadas({ cursadas, titulo }: { cursadas: CursadaResumen[]; titulo: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <caption className="sr-only">{titulo}</caption>
        <thead className="border-b border-borde-suave text-xs uppercase tracking-wide text-texto-suave">
          <tr>
            <th scope="col" className="py-2 pr-4 font-medium">
              Materia
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Cuatrimestre
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">
              Nota final
            </th>
            <th scope="col" className="py-2 font-medium">
              Situación
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-borde-suave">
          {cursadas.map((c) => (
            <tr key={c.cursoId}>
              <td className="py-3 pr-4 font-medium">{c.asignatura.nombre}</td>
              <td className="py-3 pr-4 text-etiqueta">{c.periodo.nombre}</td>
              <td className="py-3 pr-4 text-right tabular-nums">
                {c.notaFinal ?? <span aria-label="Sin nota">—</span>}
              </td>
              <td className="py-3">{SITUACION[c.estado]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
