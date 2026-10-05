import { z } from 'zod';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'se esperaba YYYY-MM-DD');
const cantidad = z.number().int().nonnegative();

/**
 * Respuesta de `GET /cursos/{cursoId}/alumnos/{alumnoId}/asistencia` (Módulo 2). El módulo no
 * tiene contrato: ruta y campos son SUPUESTOS nuestros, alineados con el schema `Asistencia`
 * de openapi.yaml (fixture `teacher/asistencia.provisional.json`). Este tipo no sale de la
 * carpeta del adaptador.
 */
export const AsistenciaAlumno = z
  .object({
    clasesDictadas: cantidad,
    presentes: cantidad,
    ausentes: cantidad,
    porcentaje: z.number().min(0).max(100),
    // No se sabe si el Módulo 2 expone el límite para quedar libre (docs/integraciones.md)
    limiteInasistencias: cantidad.nullable().optional(),
    inasistenciasRestantes: z.number().int().nullable().optional(),
    clases: z.array(z.object({ fecha, presente: z.boolean() }).passthrough()).optional(),
  })
  .passthrough();
