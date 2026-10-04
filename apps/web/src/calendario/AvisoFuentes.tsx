import type { Calendario, CategoriaCalendario } from '@uadenet/api-types';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/componentes/ui/button';
import { CATEGORIAS } from './categorias';

const MOTIVOS: Record<string, string> = {
  UPSTREAM_UNAVAILABLE: 'el servicio no está disponible',
  UPSTREAM_TIMEOUT: 'el servicio tardó demasiado',
  UPSTREAM_INVALID: 'el servicio respondió algo inesperado',
};

/** Aviso de carga parcial: nombra cada categoría que no cargó y ofrece reintentar solo esas. */
export function AvisoFuentes({
  fuentes,
  reintentar,
  reintentando,
  fallo,
}: {
  fuentes: Calendario['fuentes'];
  reintentar: (categorias: CategoriaCalendario[]) => void;
  reintentando: boolean;
  /** El último reintento también falló */
  fallo: boolean;
}) {
  const fallidas = fuentes.filter((f) => f.estado === 'ERROR');
  if (fallidas.length === 0) return null;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-item border border-aviso/30 bg-aviso-fondo p-3"
    >
      <TriangleAlert className="size-5 shrink-0 text-aviso" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-aviso-texto">Parte del calendario no cargó</p>
        <ul className="text-aviso-texto/80">
          {fallidas.map((f) => (
            <li key={f.categoria}>
              {CATEGORIAS[f.categoria].etiqueta}:{' '}
              {(f.code && MOTIVOS[f.code]) ?? 'no se pudo cargar'}.
            </li>
          ))}
        </ul>
        {fallo && !reintentando && (
          <p className="pt-1 text-aviso-texto/80">
            El reintento tampoco funcionó. Probá en unos minutos.
          </p>
        )}
      </div>
      <Button
        variant="fantasma"
        disabled={reintentando}
        onClick={() => reintentar(fallidas.map((f) => f.categoria))}
      >
        <RefreshCw className={reintentando ? 'size-4 animate-spin' : 'size-4'} aria-hidden />
        {reintentando ? 'Reintentando…' : 'Reintentar'}
      </Button>
    </div>
  );
}
