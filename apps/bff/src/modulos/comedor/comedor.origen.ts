import { z } from 'zod';

const campus = z.object({ name: z.string().nullable().optional() }).passthrough();

/**
 * Respuesta de `GET /reservations/me` (Módulo 4). Confirmado el endpoint y `slot.date`
 * (solo fecha); el detalle de `slot` y `campus` es PROVISIONAL (fixture
 * `dining/reservations-me.provisional.json`). Los ids llegan numéricos.
 * Este tipo no sale de la carpeta del adaptador.
 */
export const ReservasComedor = z
  .object({
    reservations: z.array(
      z
        .object({
          id: z.union([z.string(), z.number()]),
          slot: z
            .object({
              date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'se esperaba YYYY-MM-DD'),
              campus: campus.nullable().optional(),
            })
            .passthrough(),
          campus: campus.nullable().optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();
