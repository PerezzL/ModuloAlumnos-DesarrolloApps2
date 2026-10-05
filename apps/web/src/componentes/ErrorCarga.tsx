import { CloudOff, RefreshCw, ServerCrash, Timer, TriangleAlert, WifiOff } from 'lucide-react';
import { describirError, type TipoFalla } from '@/api/errores';
import { Button } from '@/componentes/ui/button';
import { cn } from '@/lib/utils';

const ICONOS: Record<TipoFalla, typeof CloudOff> = {
  caido: CloudOff,
  invalido: ServerCrash,
  demora: Timer,
  'sin-conexion': WifiOff,
  otro: TriangleAlert,
};

/**
 * Error común de carga. Dice qué parte falló y por qué (503, 502, 504) y muestra el
 * correlationId para reportarlo. Ofrece reintentar solo si se pasa `reintentar`: se usa en
 * consultas; una acción que escribe nunca se reintenta sola.
 */
export function ErrorCarga({
  error,
  fuente,
  reintentar,
  compacto = false,
  className,
}: {
  error: unknown;
  /** Nombre de la parte que no cargó, si el error no trae `modulo` (por ejemplo, "El saldo") */
  fuente?: string;
  reintentar?: () => void;
  compacto?: boolean;
  className?: string;
}) {
  const { tipo, titulo, mensaje, correlationId } = describirError(error, fuente);
  const Icono = ICONOS[tipo];

  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-item border border-peligro/20 bg-peligro-fondo text-left',
        compacto ? 'items-center p-3' : 'flex-col items-center p-6 text-center',
        className,
      )}
    >
      <Icono className="size-5 shrink-0 text-peligro-texto" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-peligro-texto">{titulo}</p>
        <p className="text-sm text-etiqueta">{mensaje}</p>
        {correlationId && !compacto && (
          <p className="pt-1 text-xs text-texto-suave">
            Código para reportar: <code className="select-all">{correlationId}</code>
          </p>
        )}
      </div>
      {reintentar && (
        <Button variant="fantasma" onClick={reintentar} className="shrink-0">
          <RefreshCw className="size-4" aria-hidden />
          Reintentar
        </Button>
      )}
    </div>
  );
}
