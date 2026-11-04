import type { CursadaResumen, Periodo } from '@uadenet/api-types';
import { ChevronRight, GraduationCap, TriangleAlert } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { Cargando } from '@/componentes/Cargando';
import { ErrorCarga } from '@/componentes/ErrorCarga';
import { EstadoVacio } from '@/componentes/EstadoVacio';
import { useCursadas } from '@/cursadas/consultas';
import { SITUACION } from '@/cursadas/situacion';

/** Períodos del historial, sin repetir, en el orden en que aparecen (el más reciente primero) */
function periodosDe(cursadas: CursadaResumen[]): Periodo[] {
  const vistos = new Map<string, Periodo>();
  for (const c of cursadas) if (!vistos.has(c.periodo.id)) vistos.set(c.periodo.id, c.periodo);
  return [...vistos.values()];
}

/**
 * Mis cursos (4.4): las cursadas en curso, con acceso a su detalle, y el historial con nota y
 * situación, filtrable por período (`?periodo=` en la URL). Si el Módulo 2 no respondió, el
 * historial se muestra igual, sin notas finales y con un aviso.
 */
export function Historial() {
  const { data, error, isPending, refetch } = useCursadas();
  const [params, setParams] = useSearchParams();

  if (isPending) return <Cargando texto="Cargando tu historial…" />;
  if (error) {
    return (
      <ErrorCarga error={error} fuente="El historial académico" reintentar={() => void refetch()} />
    );
  }
  const cursadas = data.items;
  if (cursadas.length === 0) {
    return (
      <EstadoVacio
        icono={GraduationCap}
        titulo="Todavía no cursaste materias"
        mensaje="Cuando te inscribas en una materia, la vas a ver acá."
        className="max-w-5xl rounded-campo border border-borde-suave bg-white"
      />
    );
  }

  const enCurso = cursadas.filter((c) => c.enCurso);
  const historial = cursadas.filter((c) => !c.enCurso);
  const sinNotasFinales = data.fuentesConError.includes('DOCENTE');
  const periodos = periodosDe(historial);
  const pedido = params.get('periodo');
  const periodo = periodos.some((p) => p.id === pedido) ? pedido : null;
  const filtrado = periodo ? historial.filter((c) => c.periodo.id === periodo) : historial;

  const elegirPeriodo = (id: string) =>
    setParams((actual) => {
      const nuevos = new URLSearchParams(actual);
      if (id) nuevos.set('periodo', id);
      else nuevos.delete('periodo');
      return nuevos;
    });

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      {enCurso.length > 0 && (
        <section aria-labelledby="titulo-en-curso">
          <h2 id="titulo-en-curso" className="pb-3 text-lg font-semibold">
            Cursando ahora
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {enCurso.map((c) => (
              <li key={c.cursoId}>
                <Link
                  to={`/alumnos/cursos/${encodeURIComponent(c.cursoId)}`}
                  className="flex items-center gap-3 rounded-campo border border-borde-suave bg-white p-4 hover:border-primario/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primario/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.asignatura.nombre}</p>
                    <p className="text-sm text-texto-suave">
                      {c.periodo.nombre} · {SITUACION[c.estado]}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-sm font-semibold text-primario">
                    Ver detalle
                    <ChevronRight className="size-4" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        aria-labelledby="titulo-historial"
        className="rounded-campo border border-borde-suave bg-white p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <h2 id="titulo-historial" className="text-lg font-semibold">
            Historial académico
          </h2>
          {periodos.length > 1 && (
            <label className="flex items-center gap-2 text-sm text-etiqueta">
              Período
              <select
                value={periodo ?? ''}
                onChange={(e) => elegirPeriodo(e.target.value)}
                className="h-9 rounded-item border border-borde bg-white px-2 text-sm text-texto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primario/40"
              >
                <option value="">Todos</option>
                {periodos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {sinNotasFinales && (
          <p
            role="alert"
            className="mb-4 flex items-center gap-2 rounded-item border border-aviso/30 bg-aviso-fondo p-3 text-sm text-aviso-texto"
          >
            <TriangleAlert className="size-4 shrink-0 text-aviso" aria-hidden />
            No pudimos cargar las notas finales: el servicio de Docente no respondió.
          </p>
        )}
        {filtrado.length === 0 ? (
          <EstadoVacio
            icono={GraduationCap}
            titulo="Todavía no terminaste ninguna materia"
            mensaje="Las materias que estás cursando aparecen arriba."
          />
        ) : (
          <TablaCursadas cursadas={filtrado} titulo="Historial académico" />
        )}
      </section>
    </div>
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
