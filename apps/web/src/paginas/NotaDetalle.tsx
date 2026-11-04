import { ArrowLeft, SearchX } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { ErrorApi } from '@/api/errores';
import { Cargando } from '@/componentes/Cargando';
import { ErrorCarga } from '@/componentes/ErrorCarga';
import { EstadoVacio } from '@/componentes/EstadoVacio';
import { useNota } from '@/cursadas/consultas';
import { instanciaLegible, notaLegible, resultadoLegible } from '@/cursadas/examen';
import { fechaLarga } from '@/cursadas/formato';

const Volver = ({ cursoId }: { cursoId: string }) => (
  <Link
    to={`/alumnos/cursos/${encodeURIComponent(cursoId)}`}
    className="flex items-center gap-1 self-start text-sm font-semibold text-primario-oscuro hover:underline"
  >
    <ArrowLeft className="size-4" aria-hidden />
    Volver a la cursada
  </Link>
);

/**
 * Detalle de la nota de un examen (4.7). Se llega desde la notificación
 * `TEACHER_EXAM_RESULT_PUBLISHED` o desde las notas del detalle de cursada. El docente se
 * muestra solo si viene.
 */
export function NotaDetalle() {
  const { cursoId = '', notaId = '' } = useParams();
  const { data, error, isPending, refetch } = useNota(cursoId, notaId);

  if (isPending) return <Cargando texto="Cargando la nota…" />;
  if (error instanceof ErrorApi && error.status === 404) {
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <Volver cursoId={cursoId} />
        <EstadoVacio
          icono={SearchX}
          titulo="No encontramos esa nota"
          mensaje="Puede que el enlace esté mal o que la nota no sea tuya."
          className="rounded-campo border border-borde-suave bg-white"
        />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <Volver cursoId={cursoId} />
        <ErrorCarga error={error} fuente="La nota" reintentar={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Volver cursoId={data.cursoId} />
      <section
        aria-labelledby="titulo-nota"
        className="flex flex-col gap-5 rounded-campo border border-borde-suave bg-white p-6"
      >
        <div>
          <h2 id="titulo-nota" className="text-lg font-semibold">
            {data.titulo}
          </h2>
          <p className="text-sm text-texto-suave">
            {[data.asignatura.nombre, data.comision && `Comisión ${data.comision}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Dato titulo="Nota" destacado>
            {notaLegible(data.nota)}
          </Dato>
          <Dato titulo="Resultado">{resultadoLegible(data.resultado)}</Dato>
          <Dato titulo="Instancia">{instanciaLegible(data.instancia)}</Dato>
          <Dato titulo="Fecha">{fechaLarga(data.fecha)}</Dato>
        </dl>

        {data.docente && (
          <dl className="border-t border-borde-suave pt-4 text-sm">
            <dt className="text-xs text-texto-suave">Docente</dt>
            <dd>{data.docente}</dd>
          </dl>
        )}
      </section>
    </div>
  );
}

function Dato({
  titulo,
  destacado = false,
  children,
}: {
  titulo: string;
  destacado?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-item bg-fondo p-3">
      <dt className="text-xs text-texto-suave">{titulo}</dt>
      <dd className={destacado ? 'text-2xl font-semibold tabular-nums' : 'font-semibold'}>
        {children}
      </dd>
    </div>
  );
}
