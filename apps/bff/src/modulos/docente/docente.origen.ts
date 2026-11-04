import { z } from 'zod';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'se esperaba YYYY-MM-DD');
const cantidad = z.number().int().nonnegative();
const id = z.union([z.string(), z.number()]);

/**
 * Respuesta de `GET /students/{studentId}/courses/{courseId}/attendance` (Módulo 2, OpenAPI
 * de `teacher-service`; fixture `teacher/attendance.json`). Este tipo no sale de la carpeta
 * del adaptador.
 */
export const AsistenciaAlumno = z
  .object({
    /** Porcentaje mínimo para quedar regular (hoy 75) */
    threshold: z.number().min(0).max(100),
    classesRecorded: cantidad,
    present: cantidad,
    justified: cantidad,
    absences: cantidad,
    attendancePercentage: z.number().min(0).max(100),
    condition: z.enum(['REGULAR', 'LIBRE']),
    classes: z.array(
      z
        .object({
          date: fecha,
          status: z.enum(['PRESENTE', 'AUSENTE', 'JUSTIFICADO']).nullable().optional(),
          note: z.string().nullable().optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

/**
 * Un examen del curso con la nota del alumno, en `GET .../grades`. `category` es la que
 * importa para la lógica: `type` puede crecer (TP_3, etc.). `gradedBy` es el id del docente
 * que cargó la nota, el mismo de Backoffice.
 */
export const ExamenAlumno = z
  .object({
    examId: id,
    name: z.string(),
    category: z.string().nullable().optional(),
    date: fecha,
    status: z.string(),
    grade: z.number().nullable().optional(),
    absent: z.boolean(),
    passed: z.boolean().nullable().optional(),
    gradedBy: z.string().nullable().optional(),
  })
  .passthrough();

/** Respuesta de `GET /students/{studentId}/courses/{courseId}/grades` (fixture `teacher/grades.json`) */
export const NotasAlumno = z
  .object({
    average: z.number().nullable().optional(),
    exams: z.array(ExamenAlumno),
  })
  .passthrough();

/**
 * Respuesta de `GET /students/{studentId}/results` (fixture `teacher/results.json`): los
 * resultados de actas del alumno. Solo se declara lo que usa el portal.
 */
export const ResultadosAlumno = z.array(
  z
    .object({
      courseId: id,
      grade: z.number().nullable().optional(),
    })
    .passthrough(),
);
