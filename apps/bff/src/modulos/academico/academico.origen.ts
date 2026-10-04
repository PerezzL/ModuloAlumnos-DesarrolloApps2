import { z } from 'zod';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'se esperaba YYYY-MM-DD');

/**
 * Respuesta de `GET /api/planificacion/turnos-examen` (Módulo 9). El endpoint está
 * implementado pero no tenemos la respuesta: los nombres de campo son PROVISIONALES
 * (fixture `academic/turnos-examen.provisional.json`). Hoy solo informa ventanas generales,
 * sin fecha por asignatura. Este tipo no sale de la carpeta del adaptador.
 */
export const TurnosExamen = z.array(
  z
    .object({
      id: z.union([z.string(), z.number()]),
      nombre: z.string(),
      fechaInicio: fecha,
      fechaFin: fecha,
    })
    .passthrough(),
);
