import { CircleCheck, CircleX, RefreshCw, WifiOff } from 'lucide-react';
import { ErrorRed } from '@/api/errores';
import { ErrorCarga } from '@/componentes/ErrorCarga';
import { Button } from '@/componentes/ui/button';
import type { useInscribir } from './consultas';
import { describirRechazo, QUE_FALTA } from './rechazos';

/**
 * Resultado del último intento de inscripción. Nada se reintenta solo: ante un error de red
 * se ofrece reintentar a mano (si la primera llegó, el Módulo 9 responde "ya inscripto").
 */
export function ResultadoInscripcion({
  inscribir,
  reintentar,
}: {
  inscribir: ReturnType<typeof useInscribir>;
  reintentar: () => void;
}) {
  if (inscribir.isPending) {
    return (
      <p role="status" className="mt-3 text-sm text-texto-suave">
        Enviando la inscripción…
      </p>
    );
  }
  if (inscribir.isSuccess) {
    return (
      <p
        role="status"
        className="mt-3 flex items-center gap-2 rounded-item border border-exito/30 bg-exito-fondo p-3 text-sm font-semibold text-exito"
      >
        <CircleCheck className="size-4" aria-hidden />
        Inscripción registrada.
      </p>
    );
  }
  const rechazo = describirRechazo(inscribir.error);
  if (rechazo) {
    // Un rechazo de negocio no cambia reintentando: no se ofrece reintentar
    return (
      <div
        role="alert"
        className="mt-3 flex gap-2 rounded-item border border-peligro/20 bg-peligro-fondo p-3 text-sm"
      >
        <CircleX className="mt-0.5 size-4 shrink-0 text-peligro-texto" aria-hidden />
        <div>
          <p className="font-semibold text-peligro-texto">{rechazo.titulo}</p>
          <p className="text-etiqueta">{rechazo.mensaje}</p>
          {rechazo.correlativasFaltantes.length > 0 && (
            <ul aria-label="Correlativas que faltan" className="list-disc pl-4 text-etiqueta">
              {rechazo.correlativasFaltantes.map((c) => (
                <li key={c.asignaturaId}>
                  {c.nombre} ({QUE_FALTA[c.tipo]})
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }
  if (inscribir.error instanceof ErrorRed) {
    return (
      <div
        role="alert"
        className="mt-3 flex flex-wrap items-center gap-3 rounded-item border border-aviso/30 bg-aviso-fondo p-3 text-sm"
      >
        <WifiOff className="size-4 shrink-0 text-aviso" aria-hidden />
        <p className="min-w-0 flex-1">
          Se cortó la conexión y no sabemos si la inscripción llegó. Podés reintentar: si ya estabas
          inscripto, te lo vamos a avisar.
        </p>
        <Button variant="fantasma" onClick={reintentar}>
          <RefreshCw className="size-4" aria-hidden />
          Reintentar
        </Button>
      </div>
    );
  }
  if (inscribir.error) {
    return (
      <ErrorCarga
        error={inscribir.error}
        fuente="La inscripción"
        reintentar={reintentar}
        compacto
        className="mt-3"
      />
    );
  }
  return null;
}
