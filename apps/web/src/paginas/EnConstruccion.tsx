import { Construction } from 'lucide-react';

export function EnConstruccion({ titulo }: { titulo: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-campo border border-borde-suave bg-white py-16 text-center">
      <Construction className="size-8 text-pista" aria-hidden />
      <p className="font-semibold">{titulo}</p>
      <p className="text-sm text-texto-suave">Esta sección todavía está en construcción.</p>
    </div>
  );
}
