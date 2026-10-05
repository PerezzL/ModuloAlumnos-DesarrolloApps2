import { X } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface Aviso {
  titulo: string;
  mensaje?: string;
  tono?: 'info' | 'error';
}

interface AvisoActivo extends Aviso {
  id: number;
}

const ContextoAvisos = createContext<(aviso: Aviso) => void>(() => undefined);

const DURACION_MS = 6000;

/** Avisos breves (toasts) en una región aria-live; se cierran solos. */
export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<AvisoActivo[]>([]);
  const siguiente = useRef(0);

  const cerrar = useCallback((id: number) => setAvisos((a) => a.filter((x) => x.id !== id)), []);
  const avisar = useCallback(
    (aviso: Aviso) => {
      const id = siguiente.current++;
      setAvisos((a) => [...a.slice(-2), { ...aviso, id }]);
      setTimeout(() => cerrar(id), DURACION_MS);
    },
    [cerrar],
  );

  return (
    <ContextoAvisos.Provider value={avisar}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
      >
        {avisos.map((a) => (
          <div
            key={a.id}
            className={cn(
              'pointer-events-auto flex gap-3 rounded-item border bg-white p-3 shadow-lg',
              a.tono === 'error' ? 'border-peligro/30' : 'border-borde-suave',
            )}
          >
            <div className="min-w-0 flex-1 text-sm">
              <p className={cn('font-semibold', a.tono === 'error' && 'text-peligro-texto')}>
                {a.titulo}
              </p>
              {a.mensaje && <p className="text-texto-suave">{a.mensaje}</p>}
            </div>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => cerrar(a.id)}
              className="self-start rounded text-pista hover:text-texto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primario/40"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ContextoAvisos.Provider>
  );
}

export const useAvisar = () => useContext(ContextoAvisos);
