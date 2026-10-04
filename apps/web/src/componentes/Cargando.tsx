import { LoaderCircle } from 'lucide-react';

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-texto-suave">
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
      <span className="text-sm">{texto}</span>
    </div>
  );
}
