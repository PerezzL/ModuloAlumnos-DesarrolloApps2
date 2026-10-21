import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ErrorApi } from '@/api/errores';
import { pedirCore } from './http';
import { aMovimiento, type Movimiento, type TransaccionCore } from './saldo';

/** Medios de pago simulados de CORE */
export type MedioPago = 'mock-approved' | 'mock-rejected' | 'mock-pending';

/**
 * Un intento de carga. La `clave` (Idempotency-Key, UUID v4) se genera una vez por intento:
 * reintentar el mismo intento repite la clave, así CORE no acredita dos veces.
 */
export interface IntentoCarga {
  clave: string;
  monto: string;
  medio: MedioPago;
}

export type ResultadoCarga =
  { tipo: 'APROBADA'; movimiento: Movimiento } | { tipo: 'PENDIENTE' } | { tipo: 'RECHAZADA' };

export const nuevoIntento = (monto: string, medio: MedioPago): IntentoCarga => ({
  clave: crypto.randomUUID(),
  monto,
  medio,
});

/**
 * `POST /api/v1/wallets/me/top-ups`. 201 con el movimiento: `POSTED` es aprobada y `PENDING`,
 * pendiente; 422 es rechazada. Cualquier
 * otra falla se lanza: en particular, un error de red (ErrorRed) no es un rechazo, porque no
 * sabemos si CORE procesó la carga.
 */
export async function cargarSaldo(intento: IntentoCarga): Promise<ResultadoCarga> {
  try {
    const { datos } = await pedirCore<TransaccionCore>('/api/v1/wallets/me/top-ups', {
      method: 'POST',
      headers: { 'Idempotency-Key': intento.clave },
      body: JSON.stringify({
        amount: intento.monto,
        currency: 'ARS',
        paymentMethodToken: intento.medio,
      }),
    });
    if (datos.status === 'PENDING') return { tipo: 'PENDIENTE' };
    return { tipo: 'APROBADA', movimiento: aMovimiento(datos) };
  } catch (error) {
    if (error instanceof ErrorApi && error.code === 'WALLET_TOPUP_REJECTED') {
      return { tipo: 'RECHAZADA' };
    }
    throw error;
  }
}

/** La carga es una escritura: nunca se reintenta sola (retry 0). */
export function useCargaSaldo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cargarSaldo,
    retry: 0,
    onSuccess: (resultado) => {
      if (resultado.tipo === 'RECHAZADA') return;
      void queryClient.invalidateQueries({ queryKey: ['movimientos'] });
      if (resultado.tipo === 'APROBADA')
        void queryClient.invalidateQueries({ queryKey: ['saldo'] });
    },
  });
}
