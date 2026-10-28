import type { Comision, MateriaOferta } from '@uadenet/api-types';
import { BookX, Clock, Info, Lock, MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Cargando } from '@/componentes/Cargando';
import { ErrorCarga } from '@/componentes/ErrorCarga';
import { EstadoVacio } from '@/componentes/EstadoVacio';
import { Button } from '@/componentes/ui/button';
import { useAvisar } from '@/componentes/Avisos';
import { useInscribir, useOferta } from '@/inscripcion/consultas';
import { EstadoComision } from '@/inscripcion/EstadoComision';
import { InscripcionCerrada } from '@/inscripcion/InscripcionCerrada';
import { QUE_FALTA } from '@/inscripcion/rechazos';
import { ResultadoInscripcion } from '@/inscripcion/ResultadoInscripcion';
import { SimularInscripcion } from '@/inscripcion/SimularInscripcion';
import { VentanaInscripcion } from '@/inscripcion/VentanaInscripcion';

interface Eleccion {
  materia: MateriaOferta;
  comision: Comision;
}

/**
 * Inscripción a materias (4.3): oferta del plan agrupada por materia. Con la inscripción
 * cerrada no se muestra la oferta, solo cuándo abre o cuándo cerró.
 */
export function Inscripcion() {
  const { data, error, isPending, refetch } = useOferta();
  const inscribir = useInscribir();
  const avisar = useAvisar();
  const [confirmando, setConfirmando] = useState<Eleccion | null>(null);
  // Comisión del último envío: el resultado se muestra en su materia
  const [enviada, setEnviada] = useState<Eleccion | null>(null);

  if (isPending) return <Cargando texto="Cargando la oferta…" />;
  if (error) {
    return (
      <ErrorCarga error={error} fuente="La oferta de materias" reintentar={() => void refetch()} />
    );
  }

  const enviar = (eleccion: Eleccion) => {
    setConfirmando(null);
    setEnviada(eleccion);
    inscribir.mutate(eleccion.comision.cursoId, {
      onSuccess: () =>
        avisar({
          titulo: 'Te inscribiste',
          mensaje: `${eleccion.materia.asignatura.nombre}, comisión ${nombreComision(eleccion.comision)}.`,
        }),
    });
  };

  const simulacion = import.meta.env.DEV && (
    <SimularInscripcion abierta={data.inscripcionAbierta} />
  );

  if (!data.inscripcionAbierta) {
    return (
      <section className="flex max-w-5xl flex-col gap-4" aria-labelledby="titulo-inscripcion">
        <h2 id="titulo-inscripcion" className="text-lg font-semibold">
          Inscripción a materias
        </h2>
        {simulacion}
        <InscripcionCerrada oferta={data} />
      </section>
    );
  }

  return (
    <section className="flex max-w-5xl flex-col gap-4" aria-labelledby="titulo-oferta">
      <div>
        <h2 id="titulo-oferta" className="text-lg font-semibold">
          Oferta del {data.periodo.nombre}
        </h2>
      </div>

      {simulacion}
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
            <Materia
              key={m.asignatura.id}
              materia={m}
              puedeInscribirse={data.inscripcionAbierta}
              enviando={inscribir.isPending}
              confirmando={
                confirmando?.materia.asignatura.id === m.asignatura.id ? confirmando : null
              }
              elegir={(comision) => setConfirmando({ materia: m, comision })}
              cancelar={() => setConfirmando(null)}
              confirmar={enviar}
              resultado={
                enviada?.materia.asignatura.id === m.asignatura.id && !inscribir.isIdle ? (
                  <ResultadoInscripcion inscribir={inscribir} reintentar={() => enviar(enviada)} />
                ) : null
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}

const nombreComision = (c: Comision) => c.nombre ?? c.cursoId;

function Materia({
  materia,
  puedeInscribirse,
  enviando,
  confirmando,
  elegir,
  cancelar,
  confirmar,
  resultado,
}: {
  materia: MateriaOferta;
  puedeInscribirse: boolean;
  enviando: boolean;
  confirmando: Eleccion | null;
  elegir: (comision: Comision) => void;
  cancelar: () => void;
  confirmar: (eleccion: Eleccion) => void;
  resultado: React.ReactNode;
}) {
  const { asignatura } = materia;
  // Con una comisión ya inscripta, no se ofrece otra de la misma materia
  const yaInscripto = materia.comisiones.some((c) => c.estado === 'INSCRIPTO');

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
          <ComisionFila
            key={c.cursoId}
            comision={c}
            accion={
              puedeInscribirse && !yaInscripto && c.estado === 'CON_CUPO' ? (
                <Button
                  disabled={enviando}
                  aria-label={`Inscribirme en ${asignatura.nombre}, comisión ${nombreComision(c)}`}
                  onClick={() => elegir(c)}
                >
                  Inscribirme
                </Button>
              ) : null
            }
          />
        ))}
      </ul>
      {confirmando && (
        <Confirmacion
          eleccion={confirmando}
          enviando={enviando}
          cancelar={cancelar}
          confirmar={confirmar}
        />
      )}
      {resultado}
    </li>
  );
}

/** Confirmación antes de enviar. Al abrirse toma el foco, así queda a la vista y se lee. */
function Confirmacion({
  eleccion,
  enviando,
  cancelar,
  confirmar,
}: {
  eleccion: Eleccion;
  enviando: boolean;
  cancelar: () => void;
  confirmar: (eleccion: Eleccion) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), [eleccion]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="group"
      aria-label="Confirmar inscripción"
      className="mt-3 flex scroll-mb-4 flex-wrap items-center gap-3 rounded-item border border-primario/30 bg-primario/5 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primario/40"
    >
      <p className="min-w-0 flex-1 text-sm">
        ¿Confirmás la inscripción en <strong>{eleccion.materia.asignatura.nombre}</strong>, comisión{' '}
        <strong>{nombreComision(eleccion.comision)}</strong>?
      </p>
      <div className="flex gap-2">
        <Button variant="fantasma" onClick={cancelar}>
          Cancelar
        </Button>
        <Button disabled={enviando} onClick={() => confirmar(eleccion)}>
          Confirmar inscripción
        </Button>
      </div>
    </div>
  );
}

const DIAS: Record<NonNullable<Comision['horarios']>[number]['dia'], string> = {
  LUNES: 'Lunes',
  MARTES: 'Martes',
  MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves',
  VIERNES: 'Viernes',
  SABADO: 'Sábado',
};

function ComisionFila({ comision, accion }: { comision: Comision; accion: React.ReactNode }) {
  // Horarios y sede son provisionales: si no vienen, la comisión se muestra sin ellos
  const horarios = comision.horarios ?? [];
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-item border border-borde-suave p-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">Comisión {nombreComision(comision)}</p>
        {(horarios.length > 0 || comision.sede) && (
          <ul aria-label="Horarios" className="flex flex-col gap-0.5 pt-1 text-sm text-texto-suave">
            {horarios.map((h) => (
              <li key={`${h.dia}-${h.desde}`} className="flex items-center gap-1.5">
                <Clock className="size-3.5 shrink-0" aria-hidden />
                {DIAS[h.dia]} {h.desde} a {h.hasta}
                {h.aula && ` · ${h.aula}`}
              </li>
            ))}
            {comision.sede && (
              <li className="flex items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                Sede {comision.sede}
              </li>
            )}
          </ul>
        )}
      </div>
      {comision.cupoMaximo !== undefined && comision.inscriptosActivos !== undefined && (
        <p className="text-sm text-texto-suave tabular-nums">
          {comision.inscriptosActivos}/{comision.cupoMaximo} inscriptos
        </p>
      )}
      <EstadoComision estado={comision.estado} />
      {accion}
    </li>
  );
}

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
