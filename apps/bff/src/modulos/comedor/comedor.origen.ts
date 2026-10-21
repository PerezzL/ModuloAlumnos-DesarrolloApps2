import { z } from 'zod';

/** Instante ISO 8601 con zona: Comedor manda UTC (`Z`) */
const instante = z
  .string()
  .regex(/(Z|[+-]\d{2}:\d{2})$/, 'se esperaba ISO 8601 con zona')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'se esperaba ISO 8601');

/**
 * Respuesta de `GET /api/v1/calendar/me?from=&to=` (Módulo 4). Confirmada (fixture
 * `dining/calendar-me.json`); solo se declaran los campos que usa el portal. `nextCursor`
 * siempre es null: no hay paginación. Este tipo no sale de la carpeta del adaptador.
 */
export const TurnosComedor = z
  .object({
    items: z.array(
      z
        .object({
          id: z.union([z.string(), z.number()]),
          siteId: z.string().nullable().optional(),
          startAt: instante,
          endAt: instante.nullable().optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();
