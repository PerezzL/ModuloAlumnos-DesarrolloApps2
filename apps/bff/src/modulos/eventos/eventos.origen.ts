import { z } from 'zod';

const instante = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'se esperaba ISO 8601');

/**
 * Respuesta de `GET /api/v1/eventos?desde=&hasta=` (Módulo 6). Confirmada (fixture
 * `events/eventos.json`); solo se declaran los campos que usa el portal.
 * Este tipo no sale de la carpeta del adaptador.
 */
export const Eventos = z.array(
  z
    .object({
      id: z.union([z.string(), z.number()]),
      titulo: z.string(),
      fechaInicio: instante,
      fechaFin: instante.nullable().optional(),
      yaInscripto: z.boolean(),
      locacion: z
        .object({
          nombre: z.string().nullable().optional(),
          sede: z.string().nullable().optional(),
        })
        .passthrough()
        .nullable()
        .optional(),
    })
    .passthrough(),
);
