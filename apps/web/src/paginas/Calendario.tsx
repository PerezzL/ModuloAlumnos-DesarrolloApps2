import type { CategoriaCalendario, ItemCalendario } from '@uadenet/api-types';
import { CalendarX, Check, ChevronLeft, ChevronRight, ListFilter } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { itemsPorDia } from '@/calendario/agrupar';
import { AvisoFuentes } from '@/calendario/AvisoFuentes';
import { CATEGORIAS, ORDEN_CATEGORIAS } from '@/calendario/categorias';
import {
  diaCorto,
  diasEntre,
  esFechaValida,
  hoy,
  moverPeriodo,
  nombreDia,
  nombreMes,
  rangoVisible,
  type Vista,
} from '@/calendario/fechas';
import { ItemCal } from '@/calendario/ItemCal';
import { useCalendario } from '@/calendario/useCalendario';
import { Cargando } from '@/componentes/Cargando';
import { ErrorCarga } from '@/componentes/ErrorCarga';
import { EstadoVacio } from '@/componentes/EstadoVacio';
import { Button } from '@/componentes/ui/button';
import { cn } from '@/lib/utils';

/** `cat=COMEDOR,EXAMEN` en la URL; sin el parámetro, todas. Así se mantiene al cambiar de mes. */
function categoriasDeUrl(valor: string | null): CategoriaCalendario[] {
  if (valor === null) return [...ORDEN_CATEGORIAS];
  const pedidas = valor.split(',');
  return ORDEN_CATEGORIAS.filter((c) => pedidas.includes(c));
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MAX_POR_DIA = 3;

/** Calendario académico (4.9): comedor, eventos y exámenes en vista mensual o semanal. */
export function Calendario() {
  const [params, setParams] = useSearchParams();
  const vista: Vista = params.get('vista') === 'semana' ? 'semana' : 'mes';
  const fechaUrl = params.get('fecha');
  const fecha = esFechaValida(fechaUrl) ? fechaUrl : hoy();
  const rango = rangoVisible(vista, fecha);
  const dias = diasEntre(rango.desde, rango.hasta);
  const categorias = categoriasDeUrl(params.get('cat'));
  const { data, error, isPending, refetch, reintento } = useCalendario(rango, categorias);

  const ir = (cambios: { vista?: Vista; fecha?: string; categorias?: CategoriaCalendario[] }) =>
    setParams((actual) => {
      const nuevos = new URLSearchParams(actual);
      nuevos.set('vista', cambios.vista ?? vista);
      nuevos.set('fecha', cambios.fecha ?? fecha);
      if (cambios.categorias) {
        if (cambios.categorias.length === ORDEN_CATEGORIAS.length) nuevos.delete('cat');
        else nuevos.set('cat', cambios.categorias.join(','));
      }
      return nuevos;
    });

  const alternar = (c: CategoriaCalendario) =>
    ir({
      categorias: categorias.includes(c)
        ? categorias.filter((x) => x !== c)
        : ORDEN_CATEGORIAS.filter((x) => x === c || categorias.includes(x)),
    });

  const titulo =
    vista === 'mes' ? nombreMes(fecha) : `${diaCorto(rango.desde)} – ${diaCorto(rango.hasta)}`;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="fantasma"
            size="icono"
            aria-label={vista === 'mes' ? 'Mes anterior' : 'Semana anterior'}
            onClick={() => ir({ fecha: moverPeriodo(vista, fecha, -1) })}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button
            variant="fantasma"
            size="icono"
            aria-label={vista === 'mes' ? 'Mes siguiente' : 'Semana siguiente'}
            onClick={() => ir({ fecha: moverPeriodo(vista, fecha, 1) })}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
        <h2 className="text-lg font-semibold first-letter:uppercase" aria-live="polite">
          {titulo}
        </h2>
        <Button variant="fantasma" onClick={() => ir({ fecha: hoy() })}>
          Hoy
        </Button>
        <div
          role="group"
          aria-label="Vista"
          className="ml-auto flex rounded-item border border-borde-suave bg-white p-0.5"
        >
          {(['mes', 'semana'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={vista === v}
              onClick={() => ir({ vista: v })}
              className={cn(
                'rounded-[10px] px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primario/40',
                vista === v ? 'bg-primario text-white' : 'text-texto-suave hover:text-texto',
              )}
            >
              {v === 'mes' ? 'Mes' : 'Semana'}
            </button>
          ))}
        </div>
      </div>

      <Filtros elegidas={categorias} alternar={alternar} />

      {categorias.length === 0 ? (
        <EstadoVacio
          icono={ListFilter}
          titulo="No elegiste ninguna categoría"
          mensaje="Activá comedor, eventos o exámenes para ver tu calendario."
          className="rounded-campo border border-borde-suave bg-white"
        />
      ) : isPending ? (
        <Cargando texto="Cargando calendario…" />
      ) : error ? (
        <ErrorCarga error={error} fuente="El calendario" reintentar={() => void refetch()} />
      ) : (
        <>
          <AvisoFuentes
            fuentes={data.fuentes}
            reintentar={(fallidas) => reintento.mutate(fallidas)}
            reintentando={reintento.isPending}
            fallo={reintento.isError}
          />
          {data.items.length === 0 && data.fuentes.every((f) => f.estado === 'OK') && (
            <EstadoVacio
              icono={CalendarX}
              titulo="No tenés nada agendado en este período"
              mensaje="Acá vas a ver tus turnos de comedor, los eventos a los que te inscribiste y los turnos de examen."
              className="rounded-campo border border-borde-suave bg-white py-6"
            />
          )}
          {vista === 'mes' ? (
            <VistaMes
              dias={dias}
              mes={fecha.slice(0, 7)}
              items={data.items}
              verSemana={(d) => ir({ vista: 'semana', fecha: d })}
            />
          ) : (
            <VistaSemana dias={dias} items={data.items} />
          )}
        </>
      )}
    </section>
  );
}

function Filtros({
  elegidas,
  alternar,
}: {
  elegidas: CategoriaCalendario[];
  alternar: (c: CategoriaCalendario) => void;
}) {
  return (
    <div role="group" aria-label="Filtrar por categoría" className="flex flex-wrap gap-2">
      {ORDEN_CATEGORIAS.map((c) => {
        const { etiqueta, icono: Icono, clases } = CATEGORIAS[c];
        const activa = elegidas.includes(c);
        return (
          <button
            key={c}
            type="button"
            aria-pressed={activa}
            onClick={() => alternar(c)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primario/40',
              activa ? clases : 'border-borde bg-white text-texto-suave hover:text-texto',
            )}
          >
            {activa ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <Icono className="size-3.5" aria-hidden />
            )}
            {etiqueta}
          </button>
        );
      })}
    </div>
  );
}

function VistaMes({
  dias,
  mes,
  items,
  verSemana,
}: {
  dias: string[];
  mes: string;
  items: ItemCalendario[];
  verSemana: (dia: string) => void;
}) {
  const porDia = itemsPorDia(items, dias);
  const hoyAr = hoy();

  return (
    <>
      {/* Pantallas medianas y grandes: grilla del mes */}
      <div className="hidden overflow-hidden rounded-campo border border-borde-suave bg-white md:block">
        <div className="grid grid-cols-7 border-b border-borde-suave bg-fondo" aria-hidden>
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="px-2 py-2 text-xs font-semibold text-texto-suave">
              {d}
            </div>
          ))}
        </div>
        <ol className="grid grid-cols-7">
          {dias.map((dia) => {
            const delDia = porDia.get(dia) ?? [];
            const fuera = !dia.startsWith(mes);
            return (
              <li
                key={dia}
                aria-label={nombreDia(dia)}
                className={cn(
                  'min-h-28 border-r border-b border-borde-suave p-1.5 [&:nth-child(7n)]:border-r-0',
                  fuera && 'bg-fondo/60',
                )}
              >
                <span
                  className={cn(
                    'mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs font-medium',
                    fuera ? 'text-pista' : 'text-etiqueta',
                    dia === hoyAr && 'bg-primario text-white',
                  )}
                  aria-current={dia === hoyAr ? 'date' : undefined}
                >
                  {Number(dia.slice(8))}
                </span>
                <ul className="flex flex-col gap-1">
                  {delDia.slice(0, MAX_POR_DIA).map((item) => (
                    <ItemCal key={item.id} item={item} dia={dia} compacto />
                  ))}
                </ul>
                {delDia.length > MAX_POR_DIA && (
                  <button
                    type="button"
                    onClick={() => verSemana(dia)}
                    className="mt-1 text-xs font-medium text-primario hover:underline"
                  >
                    +{delDia.length - MAX_POR_DIA} más
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Pantallas chicas: agenda con los días del mes que tienen algo */}
      <Agenda dias={dias.filter((d) => d.startsWith(mes))} porDia={porDia} className="md:hidden" />
    </>
  );
}

function VistaSemana({ dias, items }: { dias: string[]; items: ItemCalendario[] }) {
  const porDia = itemsPorDia(items, dias);
  const hoyAr = hoy();

  return (
    <ol className="grid gap-3 md:grid-cols-7">
      {dias.map((dia) => {
        const delDia = porDia.get(dia) ?? [];
        return (
          <li
            key={dia}
            aria-label={nombreDia(dia)}
            className={cn(
              'rounded-item border border-borde-suave bg-white p-2 md:min-h-64',
              dia === hoyAr && 'ring-2 ring-primario/40',
            )}
          >
            <p className="pb-2 text-xs font-semibold text-texto-suave first-letter:uppercase">
              {nombreDia(dia)}
            </p>
            {delDia.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {delDia.map((item) => (
                  <ItemCal key={item.id} item={item} dia={dia} />
                ))}
              </ul>
            ) : (
              <p className="text-xs text-pista">Sin actividades</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Agenda({
  dias,
  porDia,
  className,
}: {
  dias: string[];
  porDia: Map<string, ItemCalendario[]>;
  className?: string;
}) {
  const conItems = dias.filter((d) => (porDia.get(d) ?? []).length > 0);
  if (conItems.length === 0) return null;
  return (
    <ol className={cn('flex flex-col gap-3', className)}>
      {conItems.map((dia) => (
        <li key={dia} className="rounded-item border border-borde-suave bg-white p-3">
          <p className="pb-2 text-sm font-semibold first-letter:uppercase">{nombreDia(dia)}</p>
          <ul className="flex flex-col gap-1.5">
            {(porDia.get(dia) ?? []).map((item) => (
              <ItemCal key={item.id} item={item} dia={dia} />
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
