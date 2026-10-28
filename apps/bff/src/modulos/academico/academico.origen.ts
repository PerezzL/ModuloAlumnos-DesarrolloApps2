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

const id = z.union([z.string(), z.number()]);
const instante = z.string().datetime({ offset: true });

const hora = z.string().regex(/^\d{2}:\d{2}$/, 'se esperaba HH:MM');

const Horario = z
  .object({
    dia: z.enum(['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO']),
    desde: hora,
    hasta: hora,
    aula: z.string().nullable().optional(),
  })
  .passthrough();

const Asignatura = z
  .object({ id, codigo: z.string().optional(), nombre: z.string() })
  .passthrough();

/**
 * Respuesta de `GET /api/planificacion/periodos`. Implementado, pero sin respuesta de ejemplo:
 * campos PROVISIONALES (fixture `academic/periodos.provisional.json`).
 */
export const Periodos = z.array(
  z
    .object({
      id,
      nombre: z.string(),
      inscripcionDesde: instante.optional(),
      inscripcionHasta: instante.optional(),
    })
    .passthrough(),
);

/**
 * Respuesta de `GET /api/planificacion/cursos?periodoId=&planId=`. Comprometido: filtro
 * `planId` y `asignatura` anidada. Horarios pedidos, sin confirmar. Campos PROVISIONALES
 * (fixture `academic/cursos.provisional.json`).
 */
export const Cursos = z.array(
  z
    .object({
      id,
      comision: z.string().optional(),
      sede: z.string().nullable().optional(),
      cupoMaximo: z.number().int(),
      inscriptosActivos: z.number().int(),
      asignatura: Asignatura,
      horarios: z.array(Horario).optional(),
    })
    .passthrough(),
);

/**
 * Respuesta de `GET /api/academica/carreras` (Módulo 9). Implementado, pero sin respuesta de
 * ejemplo: campos PROVISIONALES (fixture `academic/carreras.provisional.json`). Solo se usa
 * para el nombre de la carrera del perfil.
 */
export const Carreras = z.array(z.object({ id, nombre: z.string() }).passthrough());

/**
 * Respuesta de `GET /api/academica/asignaturas/{asignaturaId}/correlatividades`.
 * Implementado; forma PROVISIONAL (fixture `academic/correlatividades.provisional.json`).
 */
export const Correlatividades = z.array(
  z
    .object({ asignaturaId: id, nombre: z.string(), tipo: z.enum(['REGULAR', 'APROBADA']) })
    .passthrough(),
);

/**
 * Respuesta de `GET /api/planificacion/alumnos/{alumnoId}/inscripciones?periodoId=`.
 * Comprometido; forma PROVISIONAL (fixture `academic/inscripciones-alumno.provisional.json`).
 */
export const InscripcionesAlumno = z.array(
  z
    .object({
      cursoId: id,
      comision: z.string().optional(),
      asignatura: Asignatura,
      periodo: z.object({ id, nombre: z.string() }).passthrough(),
      notaFinal: z.number().nullable().optional(),
      estado: z.enum([
        'INSCRIPTO',
        'CURSANDO',
        'BAJA',
        'REGULAR',
        'LIBRE',
        'APROBADO',
        'DESAPROBADO',
      ]),
      fecha: instante.optional(),
    })
    .passthrough(),
);

/**
 * Respuesta 201 de `POST /api/planificacion/cursos/{cursoId}/inscripciones`. Implementado,
 * pero falta qué devuelve en caso de éxito: PROVISIONAL
 * (fixture `academic/inscripcion-creada.provisional.json`).
 */
export const InscripcionCreada = z
  .object({
    id: id.optional(),
    cursoId: id,
    estado: z.enum([
      'INSCRIPTO',
      'CURSANDO',
      'BAJA',
      'REGULAR',
      'LIBRE',
      'APROBADO',
      'DESAPROBADO',
    ]),
    fecha: instante.optional(),
  })
  .passthrough();

/**
 * Cuerpo del 409 del POST de inscripción. Los códigos de error del Módulo 9 están PENDIENTES:
 * suponemos problem+json con un `code` igual a los nuestros (fixture
 * `academic/inscripcion-rechazos.provisional.json`).
 */
export const RechazoInscripcion = z
  .object({
    code: z.string().optional(),
    detail: z.string().optional(),
    correlativasFaltantes: Correlatividades.optional(),
  })
  .passthrough();
