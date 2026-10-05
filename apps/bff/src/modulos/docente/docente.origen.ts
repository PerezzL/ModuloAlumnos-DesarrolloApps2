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

/**
 * Una nota del alumno, en `GET .../notas` y `GET .../notas/{examId}` (Módulo 2, SUPUESTO;
 * fixture `teacher/notas.provisional.json`). El único identificador que trae el `actionUrl` de
 * la notificación de examen es `examId`, así que es el que usamos como id de la nota.
 */
export const Nota = z
  .object({
    examId: z.union([z.string(), z.number()]),
    instancia: z.enum(['PARCIAL', 'RECUPERATORIO', 'FINAL']),
    titulo: z.string().optional(),
    fecha: fecha.optional(),
    nota: z.number().nullable().optional(),
    // Null mientras el examen no tiene nota
    resultado: z.enum(['APROBADO', 'DESAPROBADO', 'AUSENTE']).nullable().optional(),
    docente: z.string().nullable().optional(),
    observaciones: z.string().nullable().optional(),
  })
  .passthrough();

export const Notas = z.array(Nota);
