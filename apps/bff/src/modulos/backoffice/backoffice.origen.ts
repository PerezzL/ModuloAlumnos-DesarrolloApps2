import { z } from 'zod';

/**
 * Respuesta de `GET /api/v1/backoffice/users/{userId}` (Módulo 8). PROVISIONAL: solo está
 * confirmado el endpoint; qué campos trae y si incluye `planId` está pendiente
 * (docs/integraciones.md). Todo es opcional para que un campo que falte no rompa el perfil.
 * Este tipo no sale de la carpeta del adaptador.
 */
export const UsuarioBackoffice = z
  .object({
    email: z.string().optional(),
    nombre: z.string().optional(),
    apellido: z.string().optional(),
    legajo: z.union([z.string(), z.number()]).optional(),
    carrera: z.string().optional(),
    planId: z.union([z.string(), z.number()]).nullable().optional(),
  })
  .passthrough();

export type UsuarioBackoffice = z.infer<typeof UsuarioBackoffice>;
