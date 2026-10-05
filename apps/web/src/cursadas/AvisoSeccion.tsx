import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/componentes/ui/button';

/**
 * Aviso en una sección del detalle que no cargó porque el Módulo 2 no respondió (H20). El
 * resto de la cursada es válido; reintentar vuelve a pedir el detalle completo.
 */
export function AvisoSeccion({
  que,
  reintentar,
  reintentando,
}: {
  /** "tu asistencia", "tus notas" */
  que: string;
  reintentar: () => void;
  reintentando: boolean;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-item border border-aviso/30 bg-aviso-fondo p-3"
    >
      <TriangleAlert className="size-5 shrink-0 text-aviso" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-aviso-texto">No pudimos cargar {que}</p>
        <p className="text-aviso-texto/80">El servicio de Docente no respondió. Probá de nuevo.</p>
      </div>
      <Button variant="fantasma" disabled={reintentando} onClick={reintentar}>
        <RefreshCw className={reintentando ? 'size-4 animate-spin' : 'size-4'} aria-hidden />
        {reintentando ? 'Reintentando…' : 'Reintentar'}
      </Button>
    </div>
  );
}
