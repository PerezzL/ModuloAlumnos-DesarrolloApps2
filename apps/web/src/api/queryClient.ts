import { QueryClient } from '@tanstack/react-query';
import { ErrorApi } from './errores';

/**
 * Las consultas se reintentan solas una vez si el problema puede ser pasajero (sin conexión
 * o 5xx). Un 4xx no cambia reintentando. Las mutaciones (acciones que escriben) no se
 * reintentan nunca: TanStack Query ya las deja en 0.
 */
export function crearQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (intentos, error) =>
          intentos < 1 && !(error instanceof ErrorApi && error.status < 500),
      },
    },
  });
}
