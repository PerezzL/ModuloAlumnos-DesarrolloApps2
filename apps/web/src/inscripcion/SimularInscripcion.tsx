import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { Button } from '@/componentes/ui/button';
import { config } from '@/config';
import { CLAVE_OFERTA } from './consultas';

/** `PUT /__falso/inscripcion`: endpoint de prueba del CORE falso, no existe en CORE. */
async function simular(cerrada: boolean) {
  const res = await fetch(`${config.gatewayUrl}/__falso/inscripcion`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cerrada }),
  });
  if (!res.ok) throw new Error(`El CORE falso respondió ${res.status}`);
}

/**
 * Solo en desarrollo (la página no lo monta en el build): le pide al CORE falso que simule
 * la inscripción cerrada, o que deje de simularla, y vuelve a pedir la oferta.
 */
export function SimularInscripcion({ abierta }: { abierta: boolean }) {
  const queryClient = useQueryClient();
  const cambiar = useMutation({
    mutationFn: simular,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_OFERTA }),
  });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-item border border-dashed border-borde p-2 text-xs text-texto-suave">
      <FlaskConical className="size-4 shrink-0" aria-hidden />
      <span>Demo (solo en desarrollo)</span>
      <Button
        variant="fantasma"
        className="h-8 px-3 text-xs"
        disabled={cambiar.isPending}
        onClick={() => cambiar.mutate(abierta)}
      >
        {abierta ? 'Simular inscripción cerrada' : 'Quitar la simulación'}
      </Button>
      {cambiar.isError && (
        <span role="alert" className="text-peligro-texto">
          No se pudo cambiar: ¿está corriendo el CORE falso?
        </span>
      )}
    </div>
  );
}
