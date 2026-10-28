import { z } from 'zod';

const id = z.union([z.string(), z.number()]);

/**
 * Respuesta de `GET /api/v1/backoffice/users/{userId}` (Módulo 8). Los campos salen de su
 * documento de flujo de datos; `careers` lo adelantaron después y todavía no está publicado.
 * La ruta definitiva está a confirmar (docs/integraciones.md). Todo es opcional para que un
 * campo que falte no rompa el perfil. Este tipo no sale de la carpeta del adaptador.
 */
export const UsuarioBackoffice = z
  .object({
    email: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    fileNumber: id.optional(),
    /** Ids del Módulo 9 (numéricos, mandados como texto). Un plan por carrera. */
    careers: z
      .array(z.object({ careerId: id, planId: id }).passthrough())
      .nullable()
      .optional(),
  })
  .passthrough();
export type UsuarioBackoffice = z.infer<typeof UsuarioBackoffice>;

/**
 * Respuesta de `GET /api/v1/backoffice/sites?cursor=&limit=` (Módulo 8). Confirmada por su
 * documento de flujo de datos (fixture `backoffice/sites.json`); solo se declaran los campos
 * que usa el portal. Este tipo no sale de la carpeta del adaptador.
 */
export const SedesBackoffice = z
  .object({
    items: z.array(z.object({ siteId: z.string(), name: z.string() }).passthrough()),
    nextCursor: z.string().nullable().optional(),
  })
  .passthrough();
