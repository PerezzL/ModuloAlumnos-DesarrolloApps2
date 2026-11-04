import type { Asistencia } from '@uadenet/api-types';
import { CalendarClock, CircleCheck, CircleDashed, CircleX, FileCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { EstadoVacio } from '@/componentes/EstadoVacio';
import { fechaLarga, formatearPorcentaje } from './formato';
import { Seccion } from './Seccion';

/**
 * Asistencia en la cursada (4.5), tal como la informa el Módulo 2: sin clases dictadas se
 * muestra un estado vacío, no un 0 %. Las faltas justificadas cuentan como asistencia.
 */
export function SeccionAsistencia({
  asistencia,
  children,
}: {
  asistencia: Asistencia;
  /** Lo que va arriba del listado, por ejemplo el indicador de faltas */
  children?: ReactNode;
}) {
  return (
    <Seccion id="titulo-asistencia" titulo="Asistencia">
      {asistencia.clasesDictadas === 0 ? (
        <EstadoVacio
          icono={CalendarClock}
          titulo="Todavía no hubo clases"
          mensaje="Cuando el docente registre la primera clase, vas a ver tu asistencia acá."
        />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Dato titulo="Clases dictadas" valor={asistencia.clasesDictadas} />
            <Dato titulo="Presentes" valor={asistencia.presentes} />
            <Dato titulo="Justificadas" valor={asistencia.justificadas} />
            <Dato titulo="Ausentes" valor={asistencia.ausentes} />
            <Dato titulo="Porcentaje" valor={formatearPorcentaje(asistencia.porcentaje)} />
          </dl>
          {children}
          {asistencia.clases.length > 0 && (
            <ul aria-label="Clases" className="divide-y divide-borde-suave text-sm">
              {asistencia.clases.map((c) => {
                const { texto, icono: Icono, clases } = ESTADO_CLASE[c.estado ?? 'SIN_REGISTRO'];
                return (
                  <li key={c.fecha} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <span className="flex-1">{fechaLarga(c.fecha)}</span>
                    <span className={`flex items-center gap-1 font-semibold ${clases}`}>
                      <Icono className="size-4" aria-hidden />
                      {texto}
                    </span>
                    {c.comentario && (
                      <span className="w-full text-xs text-texto-suave">{c.comentario}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </Seccion>
  );
}

/** Cómo se ve cada estado de una clase. Sin estado: la clase no tiene registro del alumno. */
const ESTADO_CLASE = {
  PRESENTE: { texto: 'Presente', icono: CircleCheck, clases: 'text-exito' },
  JUSTIFICADO: { texto: 'Justificada', icono: FileCheck, clases: 'text-aviso-texto' },
  AUSENTE: { texto: 'Ausente', icono: CircleX, clases: 'text-peligro-texto' },
  SIN_REGISTRO: { texto: 'Sin registrar', icono: CircleDashed, clases: 'text-texto-suave' },
};

function Dato({ titulo, valor }: { titulo: string; valor: ReactNode }) {
  return (
    <div className="rounded-item bg-fondo p-3">
      <dt className="text-xs text-texto-suave">{titulo}</dt>
      <dd className="text-xl font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}
