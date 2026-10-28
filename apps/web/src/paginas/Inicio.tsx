import type { ItemCalendario } from '@uadenet/api-types';
import { ArrowRight, Bell, CalendarDays, Wallet, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { usePerfil } from '@/api/consultas';
import { CATEGORIAS } from '@/calendario/categorias';
import { diaDe, hoy, horaDe, nombreDia, sumarDias } from '@/calendario/fechas';
import { useCalendario } from '@/calendario/useCalendario';
import { Cargando } from '@/componentes/Cargando';
import { ErrorCarga } from '@/componentes/ErrorCarga';
import { formatearMonto } from '@/core/monto';
import { useNoLeidas } from '@/core/notificaciones';
import { useSaldo } from '@/core/saldo';
import { AvisoInscripcion } from '@/inscripcion/AvisoInscripcion';
import { useSesion } from '@/sesion/SesionProvider';

/** Días hacia adelante en los que se busca el próximo evento o examen (máximo del BFF: 62) */
const HORIZONTE_DIAS = 60;

/**
 * Inicio (4.2): aviso de inscripción abierta y resumen con saldo, notificaciones sin
 * leer y lo próximo del calendario. Cada
 * tarjeta carga por su cuenta: si una falla, las demás se muestran igual.
 */
export function Inicio() {
  const { estado } = useSesion();
  const { data: perfil } = usePerfil();
  const nombre = perfil?.nombre ?? (estado.tipo === 'autenticado' ? estado.usuario.email : '');

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold">Hola, {nombre} 👋</h2>
        <p className="pt-1 text-sm text-texto-suave first-letter:uppercase">{nombreDia(hoy())}</p>
      </div>
      <AvisoInscripcion />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <TarjetaSaldo />
        <TarjetaNotificaciones />
        <TarjetaProximo />
      </div>
    </section>
  );
}

function Tarjeta({
  titulo,
  icono: Icono,
  enlace,
  textoEnlace,
  children,
}: {
  titulo: string;
  icono: LucideIcon;
  enlace: string;
  textoEnlace: string;
  children: ReactNode;
}) {
  return (
    <article
      aria-label={titulo}
      className="flex flex-col gap-3 rounded-campo border border-borde-suave bg-white p-5"
    >
      <h3 className="flex items-center gap-2 text-sm font-medium text-texto-suave">
        <Icono className="size-4" aria-hidden />
        {titulo}
      </h3>
      <div className="flex-1">{children}</div>
      <Link
        to={enlace}
        className="flex items-center gap-1 self-start text-sm font-medium text-primario hover:underline"
      >
        {textoEnlace}
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </article>
  );
}

function TarjetaSaldo() {
  const { data, error, isPending, refetch } = useSaldo();
  return (
    <Tarjeta
      titulo="Saldo"
      icono={Wallet}
      enlace="/cuenta-corriente"
      textoEnlace="Cuenta corriente"
    >
      {isPending ? (
        <Cargando />
      ) : error ? (
        <ErrorCarga error={error} fuente="El saldo" reintentar={() => void refetch()} compacto />
      ) : (
        <p className="text-3xl font-bold tabular-nums">{formatearMonto(data.monto, data.moneda)}</p>
      )}
    </Tarjeta>
  );
}

function TarjetaNotificaciones() {
  const { data, error, isPending, refetch } = useNoLeidas();
  return (
    <Tarjeta
      titulo="Notificaciones sin leer"
      icono={Bell}
      enlace="/notificaciones"
      textoEnlace="Ver notificaciones"
    >
      {isPending ? (
        <Cargando />
      ) : error ? (
        <ErrorCarga
          error={error}
          fuente="Las notificaciones"
          reintentar={() => void refetch()}
          compacto
        />
      ) : (
        <p className="text-3xl font-bold tabular-nums">
          {data}
          <span className="sr-only"> sin leer</span>
          {data === 0 && (
            <span className="block pt-1 text-sm font-normal text-texto-suave">Estás al día.</span>
          )}
        </p>
      )}
    </Tarjeta>
  );
}

/** El primer evento o examen que todavía no terminó */
function proximo(items: ItemCalendario[], ahora = Date.now()) {
  const dia = hoy(new Date(ahora));
  return items.find((i) =>
    i.todoElDia ? diaDe(i.fin ?? i.inicio) >= dia : Date.parse(i.fin ?? i.inicio) >= ahora,
  );
}

function TarjetaProximo() {
  const desde = hoy();
  const { data, error, isPending, refetch } = useCalendario(
    { desde, hasta: sumarDias(desde, HORIZONTE_DIAS) },
    ['EVENTO', 'EXAMEN'],
  );
  const item = data && proximo(data.items);
  const fallidas = data?.fuentes.filter((f) => f.estado === 'ERROR') ?? [];

  return (
    <Tarjeta
      titulo="Próximo evento o examen"
      icono={CalendarDays}
      enlace="/calendario"
      textoEnlace="Ver calendario"
    >
      {isPending ? (
        <Cargando />
      ) : error ? (
        <ErrorCarga
          error={error}
          fuente="El calendario"
          reintentar={() => void refetch()}
          compacto
        />
      ) : (
        <>
          {item ? (
            <div>
              <p className="text-xs font-medium text-texto-suave">
                {CATEGORIAS[item.categoria].singular}
              </p>
              <p className="font-semibold">{item.titulo}</p>
              <p className="text-sm text-etiqueta first-letter:uppercase">
                {nombreDia(diaDe(item.inicio))}
                {!item.todoElDia && `, ${horaDe(item.inicio)}`}
                {item.lugar && ` · ${item.lugar}`}
              </p>
            </div>
          ) : (
            <p className="text-sm text-texto-suave">
              No tenés eventos ni exámenes en los próximos {HORIZONTE_DIAS} días.
            </p>
          )}
          {fallidas.length > 0 && (
            <p role="status" className="pt-2 text-xs text-aviso">
              No pudimos cargar{' '}
              {fallidas.map((f) => CATEGORIAS[f.categoria].etiqueta.toLowerCase()).join(' ni ')}.
            </p>
          )}
        </>
      )}
    </Tarjeta>
  );
}
