import { z } from 'zod';

const id = z.union([z.string(), z.number()]);

/**
 * Respuesta de `GET /internal/v1/users/{userId}` (Módulo 8, spec BO1), la misma que por el
 * Gateway. Todo es opcional para que un campo que falte no rompa el perfil. Este tipo no sale
 * de la carpeta del adaptador.
 */
export const UsuarioBackoffice = z
  .object({
    email: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    fileNumber: id.optional(),
    /** Carrera del alumno (id del Módulo 9). Confirmado; null si no tiene. */
    careerId: id.nullable().optional(),
    /** Ids del Módulo 9 (numéricos, mandados como texto). Un plan por carrera. */
    careers: z
      .array(z.object({ careerId: id, planId: id }).passthrough())
      .nullable()
      .optional(),
  })
  .passthrough();
export type UsuarioBackoffice = z.infer<typeof UsuarioBackoffice>;

/**
 * Respuesta de `GET /internal/v1/sites?cursor=&limit=` (Módulo 8, spec BO1; fixture
 * `backoffice/sites.json`). Solo se declaran los campos que usa el portal. Este tipo no sale
 * de la carpeta del adaptador.
 */
export const SedesBackoffice = z
  .object({
    items: z.array(z.object({ siteId: z.string(), name: z.string() }).passthrough()),
    nextCursor: z.string().nullable().optional(),
  })
  .passthrough();
