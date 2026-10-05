import { usePerfil } from '@/api/consultas';
import { Cargando } from '@/componentes/Cargando';
import { ErrorCarga } from '@/componentes/ErrorCarga';
import { useSesion } from '@/sesion/SesionProvider';

function Dato({ etiqueta, valor }: { etiqueta: string; valor?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-texto-suave">{etiqueta}</dt>
      <dd className="pt-0.5 font-medium">{valor || '—'}</dd>
    </div>
  );
}

/** Perfil (4.2): solo lo que trae `GET /me`. Los datos de Backoffice son provisionales. */
export function Perfil() {
  const { estado } = useSesion();
  const { data: perfil, error, isPending, refetch } = usePerfil();
  const email = estado.tipo === 'autenticado' ? estado.usuario.email : undefined;

  return (
    <section className="max-w-2xl rounded-campo border border-borde-suave bg-white p-6">
      <h2 className="pb-4 text-lg font-semibold">Mis datos</h2>
      {isPending ? (
        <Cargando />
      ) : (
        <>
          {error && (
            <ErrorCarga
              error={error}
              fuente="El servicio de datos personales"
              reintentar={() => void refetch()}
              className="mb-4"
            />
          )}
          <dl className="grid gap-4 sm:grid-cols-2">
            <Dato etiqueta="Nombre" valor={perfil?.nombre} />
            <Dato etiqueta="Apellido" valor={perfil?.apellido} />
            <Dato etiqueta="Mail" valor={perfil?.email ?? email} />
            <Dato etiqueta="Legajo" valor={perfil?.legajo} />
            <Dato etiqueta="Carrera" valor={perfil?.carrera} />
          </dl>
        </>
      )}
    </section>
  );
}
