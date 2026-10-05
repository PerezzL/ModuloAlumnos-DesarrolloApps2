import type { Asistencia } from '@uadenet/api-types';
import { CalendarClock, CircleCheck, CircleX } from 'lucide-react';
import type { ReactNode } from 'react';
import { EstadoVacio } from '@/componentes/EstadoVacio';
import { fechaLarga, formatearPorcentaje } from './formato';

/**
 * Asistencia en la cursada (4.5). Los datos son del Módulo 2 y su forma es una suposición
 * nuestra (`x-provisional`): sin clases dictadas se muestra un estado vacío, no un 0 %.
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
    <Seccion>
      {asistencia.clasesDictadas === 0 ? (
        <EstadoVacio
          icono={CalendarClock}
          titulo="Todavía no hubo clases"
          mensaje="Cuando el docente registre la primera clase, vas a ver tu asistencia acá."
        />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Dato titulo="Clases dictadas" valor={asistencia.clasesDictadas} />
            <Dato titulo="Presentes" valor={asistencia.presentes} />
            <Dato titulo="Ausentes" valor={asistencia.ausentes} />
            <Dato titulo="Porcentaje" valor={formatearPorcentaje(asistencia.porcentaje)} />
          </dl>
          {children}
          {asistencia.clases && asistencia.clases.length > 0 && (
            <ul aria-label="Clases" className="divide-y divide-borde-suave text-sm">
              {asistencia.clases.map((c) => (
                <li key={c.fecha} className="flex items-center justify-between gap-3 py-2">
                  <span>{fechaLarga(c.fecha)}</span>
                  {c.presente ? (
                    <span className="flex items-center gap-1 font-semibold text-exito">
                      <CircleCheck className="size-4" aria-hidden />
                      Presente
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-semibold text-peligro-texto">
                      <CircleX className="size-4" aria-hidden />
                      Ausente
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Seccion>
  );
}

/** Contenedor de la sección, también para el aviso cuando no cargó */
export function Seccion({ children }: { children: ReactNode }) {
  return (
    <section
      aria-labelledby="titulo-asistencia"
      className="flex flex-col gap-4 rounded-campo border border-borde-suave bg-white p-6"
    >
      <h3 id="titulo-asistencia" className="text-base font-semibold">
        Asistencia
      </h3>
      {children}
    </section>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: ReactNode }) {
  return (
    <div className="rounded-item bg-fondo p-3">
      <dt className="text-xs text-texto-suave">{titulo}</dt>
      <dd className="text-xl font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}
