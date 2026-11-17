import { z } from 'zod';

/**
 * Respuestas del Módulo 9 según su documento de integración (octubre 2026) y el pedido de
 * alta en el Gateway que le mandó a CORE (noviembre 2026). CORE todavía no lo confirmó: las
 * fixtures siguen siendo `academic/*.provisional.json`. Estos tipos no salen de la carpeta
 * del adaptador.
 *
 * Los ids propios del Módulo 9 son numéricos (`Long`); se aceptan también como texto y se
 * pasan a string opaco. Fechas `YYYY-MM-DD` y horas `HH:mm:ss`.
 */

const id = z.union([z.string(), z.number()]);
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'se esperaba YYYY-MM-DD');
const hora = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'se esperaba HH:mm:ss');

const EstadoInscripcion = z.enum([
  'INSCRIPTO',
  'CURSANDO',
  'BAJA',
  'REGULAR',
  'LIBRE',
  'APROBADO',
  'DESAPROBADO',
]);

/** `GET /api/planificacion/turnos-examen`: ventanas generales, sin fecha por asignatura. */
export const TurnosExamen = z.array(
  z.object({ id, nombre: z.string(), fechaInicio: fecha, fechaFin: fecha }).passthrough(),
);

const Periodo = z
  .object({
    id,
    anio: z.number().int(),
    numero: z.number().int(),
    fechaInicio: fecha,
    fechaFin: fecha,
    inscripcionDesde: fecha.nullable().optional(),
    inscripcionHasta: fecha.nullable().optional(),
  })
  .passthrough();

/** `GET /api/planificacion/periodos`. Sin `nombre`: lo arma el mapper con año y número. */
export const Periodos = z.array(Periodo);

const AsignaturaRef = z.object({ id, codigo: z.string(), nombre: z.string() }).passthrough();

/**
 * Horario de un curso: uno solo, con el día en inglés. Cursos viejos pueden traerlo en null.
 * Un día fuera de lunes a sábado invalida la respuesta.
 */
const camposHorario = {
  diaSemana: z
    .enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'])
    .nullable()
    .optional(),
  horaInicio: hora.nullable().optional(),
  horaFin: hora.nullable().optional(),
  aulaNombre: z.string().nullable().optional(),
};

const camposCurso = {
  id,
  codigo: z.string(),
  estado: z.enum(['PLANIFICADO', 'EN_CURSO', 'FINALIZADO', 'CANCELADO']),
  sedeNombre: z.string().nullable().optional(),
  cupoMaximo: z.number().int(),
  inscriptosActivos: z.number().int(),
  ...camposHorario,
};

/**
 * `GET /api/planificacion/cursos?periodoId=`. Trae solo `asignaturaId`: el nombre sale de las
 * asignaturas del plan. No filtra por plan.
 */
export const Cursos = z.array(z.object({ ...camposCurso, asignaturaId: id }).passthrough());

/** `GET /api/academica/planes/{planId}/asignaturas`: las materias del plan. */
export const AsignaturasPlan = z.array(AsignaturaRef);

/**
 * `GET /api/academica/carreras` y `/carreras/con-ultimo-plan-activo`. El segundo trae el plan
 * activo cargado; el primero puede traerlo en null.
 */
export const Carreras = z.array(
  z
    .object({
      id,
      nombre: z.string(),
      ultimoPlanActivo: z.object({ id }).passthrough().nullable().optional(),
    })
    .passthrough(),
);

/** `GET /api/academica/asignaturas/{asignaturaId}/correlatividades`, agrupadas por tipo. */
export const Correlatividades = z
  .object({
    asignaturaId: id,
    condiciones: z.array(
      z
        .object({
          tipo: z.enum(['REGULAR', 'APROBADA']),
          materiasCorrelativas: z.array(AsignaturaRef),
        })
        .passthrough(),
    ),
  })
  .passthrough();

/**
 * `GET /api/planificacion/alumnos/{alumnoId}/inscripciones?periodoId=`: cada inscripción con
 * su curso, que trae la asignatura y el período anidados.
 */
export const InscripcionesAlumno = z.array(
  z
    .object({
      id,
      fechaInscripcion: fecha.nullable().optional(),
      estado: EstadoInscripcion,
      curso: z
        .object({ ...camposCurso, asignatura: AsignaturaRef, periodo: Periodo })
        .passthrough(),
    })
    .passthrough(),
);

/** 201 de `POST /api/planificacion/cursos/{cursoId}/inscripciones`. No trae el `cursoId`. */
export const InscripcionCreada = z
  .object({ id, fechaInscripcion: fecha.nullable().optional(), estado: EstadoInscripcion })
  .passthrough();

/**
 * Error del Módulo 9 (problem+json). Los `code` son genéricos (`BUSINESS_RULE_VIOLATION`,
 * `DATA_CONFLICT`, ...): no hay uno por motivo de rechazo.
 */
export const ProblemaModulo = z
  .object({ code: z.string().optional(), detail: z.string().optional() })
  .passthrough();
