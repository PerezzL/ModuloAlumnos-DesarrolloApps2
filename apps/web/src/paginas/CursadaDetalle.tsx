import { ArrowLeft, SearchX } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { ErrorApi } from '@/api/errores';
import { Cargando } from '@/componentes/Cargando';
import { ErrorCarga } from '@/componentes/ErrorCarga';
import { EstadoVacio } from '@/componentes/EstadoVacio';
import { useCursada } from '@/cursadas/consultas';
import { IndicadorFaltas } from '@/cursadas/IndicadorFaltas';
import { SeccionAsistencia } from '@/cursadas/SeccionAsistencia';
import { SITUACION } from '@/cursadas/situacion';

const Volver = () => (
  <Link
    to="/mis-cursos"
    className="flex items-center gap-1 self-start text-sm font-semibold text-primario-oscuro hover:underline"
  >
    <ArrowLeft className="size-4" aria-hidden />
    Volver a mis cursos
  </Link>
);

/**
 * Detalle de cursada (4.5), en la ruta `/alumnos/cursos/{cursoId}` del contrato. La situación
 * es la del Módulo 9: el portal no la calcula.
 */
export function CursadaDetalle() {
  const { cursoId = '' } = useParams();
  const { data, error, isPending, refetch } = useCursada(cursoId);

  if (isPending) return <Cargando texto="Cargando la cursada…" />;
  if (error instanceof ErrorApi && error.status === 404) {
    return (
      <div className="flex max-w-4xl flex-col gap-4">
        <Volver />
        <EstadoVacio
          icono={SearchX}
          titulo="No encontramos esa cursada"
          mensaje="Puede que el enlace esté mal o que no estés inscripto en ese curso."
          className="rounded-campo border border-borde-suave bg-white"
        />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex max-w-4xl flex-col gap-4">
        <Volver />
        <ErrorCarga error={error} fuente="La cursada" reintentar={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <Volver />
      <section
        aria-labelledby="titulo-cursada"
        className="flex flex-wrap items-start justify-between gap-3 rounded-campo border border-borde-suave bg-white p-6"
      >
        <div>
          <h2 id="titulo-cursada" className="text-lg font-semibold">
            {data.asignatura.nombre}
          </h2>
          <p className="text-sm text-texto-suave">
            {[data.comision && `Comisión ${data.comision}`, data.periodo.nombre]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <p className="rounded-full bg-fondo px-2.5 py-0.5 text-xs font-semibold text-etiqueta">
          <span className="sr-only">Situación: </span>
          {SITUACION[data.estado]}
        </p>
      </section>
      {data.asistencia && (
        <SeccionAsistencia asistencia={data.asistencia}>
          <IndicadorFaltas estado={data.estado} asistencia={data.asistencia} />
        </SeccionAsistencia>
      )}
    </div>
  );
}
