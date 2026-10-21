import { http, HttpResponse, type HttpHandler } from 'msw';
import { GW } from './app-e2e';
import { fixture } from './fixtures';

/** Rutas de las tres fuentes del calendario detrás del Gateway simulado */
export const RUTAS_CALENDARIO = {
  COMEDOR: `${GW}/api/v1/dining/calendar/me`,
  EVENTO: `${GW}/api/v1/events/eventos`,
  EXAMEN: `${GW}/api/v1/academic/planificacion/turnos-examen`,
} as const;

/** Catálogo de sedes de Backoffice: Comedor manda solo el `siteId` */
export const RUTA_SEDES = `${GW}/api/v1/backoffice/sites`;

export type FuenteCalendario = keyof typeof RUTAS_CALENDARIO;

/**
 * Las tres fuentes y las sedes respondiendo con sus fixtures; cuenta cuántas veces se llamó a
 * cada fuente
 */
export function fuentesConFixtures(llamadas: Partial<Record<FuenteCalendario, number>> = {}) {
  const responder =
    (fuente: FuenteCalendario, cuerpo: object): Parameters<typeof http.get>[1] =>
    () => {
      llamadas[fuente] = (llamadas[fuente] ?? 0) + 1;
      return HttpResponse.json(cuerpo);
    };
  return [
    http.get(RUTAS_CALENDARIO.COMEDOR, responder('COMEDOR', fixture('dining/calendar-me.json'))),
    http.get(RUTA_SEDES, () => HttpResponse.json(fixture('backoffice/sites.json'))),
    http.get(RUTAS_CALENDARIO.EVENTO, responder('EVENTO', fixture('events/eventos.json'))),
    http.get(
      RUTAS_CALENDARIO.EXAMEN,
      responder('EXAMEN', fixture('academic/turnos-examen.provisional.json')),
    ),
  ] satisfies HttpHandler[];
}

/** Una fuente que responde el Gateway con este status (503 caído, 502 inválido, 504 timeout) */
export const fuenteCaida = (fuente: FuenteCalendario, status = 503) =>
  http.get(RUTAS_CALENDARIO[fuente], () => new HttpResponse(null, { status }));
