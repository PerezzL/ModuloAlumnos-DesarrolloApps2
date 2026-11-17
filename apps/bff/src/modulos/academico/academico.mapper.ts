import type {
  Asignatura,
  Horario,
  Inscripcion,
  ItemCalendario,
  ProblemaInscripcion,
} from '@uadenet/api-types';
import { inicioDelDia, OFFSET_AR, type Rango, solapaDias } from '../../calendario/rango';
import { ProblemaError } from '../../comun/problema';
import { idOpaco, parsearOrigen } from '../comun';
import type {
  Correlativa,
  CursoDelPeriodo,
  InscripcionAlumno,
  PeriodoAcademico,
} from './academico.modelo';
import {
  AsignaturasPlan,
  Carreras,
  Correlatividades,
  Cursos,
  InscripcionCreada,
  InscripcionesAlumno,
  Periodos,
  ProblemaModulo,
  TurnosExamen,
} from './academico.origen';

/**
 * Turnos de examen → ítems de calendario de todo el día. `inicio` y `fin` son las 00:00 del
 * primer y del último día de la ventana (ambos inclusive). Se quedan los que se solapan con
 * el rango, porque el Módulo 9 no filtra por fecha.
 */
export function turnosAItems(datos: unknown, rango: Rango): ItemCalendario[] {
  return parsearOrigen('GESTION_ACADEMICA', TurnosExamen, datos)
    .filter((t) => solapaDias(rango, t.fechaInicio, t.fechaFin))
    .map((t) => ({
      id: `EXAMEN:${idOpaco(t.id)}`,
      categoria: 'EXAMEN',
      titulo: t.nombre,
      inicio: inicioDelDia(t.fechaInicio),
      fin: inicioDelDia(t.fechaFin),
      todoElDia: true,
      lugar: null,
    }));
}

const asignatura = (a: { id: string | number; codigo: string; nombre: string }): Asignatura => ({
  id: idOpaco(a.id),
  codigo: a.codigo,
  nombre: a.nombre,
});

/** El Módulo 9 no le da nombre al período: se arma con el número y el año. */
const nombrePeriodo = (p: { anio: number; numero: number }) =>
  `${p.numero}° cuatrimestre ${p.anio}`;

/** `YYYY-MM-DD` → el último instante de ese día en Argentina (la ventana lo incluye completo). */
const finDelDia = (fecha: string) => `${fecha}T23:59:59.999${OFFSET_AR}`;

export function aPeriodos(datos: unknown): PeriodoAcademico[] {
  return parsearOrigen('GESTION_ACADEMICA', Periodos, datos).map((p) => ({
    id: idOpaco(p.id),
    nombre: nombrePeriodo(p),
    ...(p.inscripcionDesde && { inscripcionDesde: inicioDelDia(p.inscripcionDesde) }),
    ...(p.inscripcionHasta && { inscripcionHasta: finDelDia(p.inscripcionHasta) }),
  }));
}

const DIAS: Record<string, Horario['dia']> = {
  MONDAY: 'LUNES',
  TUESDAY: 'MARTES',
  WEDNESDAY: 'MIERCOLES',
  THURSDAY: 'JUEVES',
  FRIDAY: 'VIERNES',
  SATURDAY: 'SABADO',
};

/** `HH:mm:ss` → `HH:MM`, como lo pide el contrato. */
const horaCorta = (hora: string) => hora.slice(0, 5);

/** El único horario del curso, o ninguno si viene incompleto. */
function horarios(c: {
  diaSemana?: string | null;
  horaInicio?: string | null;
  horaFin?: string | null;
  aulaNombre?: string | null;
}): Horario[] {
  if (!c.diaSemana || !c.horaInicio || !c.horaFin) return [];
  return [
    {
      dia: DIAS[c.diaSemana]!,
      desde: horaCorta(c.horaInicio),
      hasta: horaCorta(c.horaFin),
      aula: c.aulaNombre ?? null,
    },
  ];
}

/** Las comisiones canceladas o terminadas no se ofrecen. */
const SE_OFRECE = new Set(['PLANIFICADO', 'EN_CURSO']);

export function aCursos(datos: unknown): CursoDelPeriodo[] {
  return parsearOrigen('GESTION_ACADEMICA', Cursos, datos)
    .filter((c) => SE_OFRECE.has(c.estado))
    .map((c) => ({
      cursoId: idOpaco(c.id),
      asignaturaId: idOpaco(c.asignaturaId),
      nombre: c.codigo,
      sede: c.sedeNombre ?? null,
      horarios: horarios(c),
      cupoMaximo: c.cupoMaximo,
      inscriptosActivos: c.inscriptosActivos,
    }));
}

export function aAsignaturasPlan(datos: unknown): Asignatura[] {
  return parsearOrigen('GESTION_ACADEMICA', AsignaturasPlan, datos).map(asignatura);
}

/** Carreras → nombre por id, para resolver la carrera del perfil. */
export function aCarreras(datos: unknown): Map<string, string> {
  return new Map(
    parsearOrigen('GESTION_ACADEMICA', Carreras, datos).map((c) => [idOpaco(c.id), c.nombre]),
  );
}

/** Carreras con su plan activo → id del plan por id de carrera (sin plan, no figura). */
export function aPlanesActivos(datos: unknown): Map<string, string> {
  return new Map(
    parsearOrigen('GESTION_ACADEMICA', Carreras, datos).flatMap((c) =>
      c.ultimoPlanActivo ? [[idOpaco(c.id), idOpaco(c.ultimoPlanActivo.id)] as const] : [],
    ),
  );
}

/** Condiciones agrupadas por tipo → una correlativa por materia, con su tipo. */
export function aCorrelativas(datos: unknown): Correlativa[] {
  return parsearOrigen('GESTION_ACADEMICA', Correlatividades, datos).condiciones.flatMap((c) =>
    c.materiasCorrelativas.map((m) => ({
      asignaturaId: idOpaco(m.id),
      nombre: m.nombre,
      tipo: c.tipo,
    })),
  );
}

export function aInscripciones(datos: unknown): InscripcionAlumno[] {
  return parsearOrigen('GESTION_ACADEMICA', InscripcionesAlumno, datos).map(
    ({ curso, estado, fechaInscripcion }) => ({
      cursoId: idOpaco(curso.id),
      comision: curso.codigo,
      asignatura: asignatura(curso.asignatura),
      periodo: { id: idOpaco(curso.periodo.id), nombre: nombrePeriodo(curso.periodo) },
      inicioPeriodo: curso.periodo.fechaInicio,
      estado,
      ...(fechaInscripcion && { fecha: fechaInscripcion }),
    }),
  );
}

/** 201 del Módulo 9 → Inscripcion. No trae el curso: es el que se pidió. */
export function aInscripcion(datos: unknown, cursoId: string): Inscripcion {
  const i = parsearOrigen('GESTION_ACADEMICA', InscripcionCreada, datos);
  return {
    id: idOpaco(i.id),
    cursoId,
    estado: i.estado,
    ...(i.fechaInscripcion && { fecha: i.fechaInscripcion }),
  };
}

type CodigoRechazo = NonNullable<ProblemaInscripcion['code']>;

/**
 * `code` del Módulo 9 que nombran un motivo concreto → el nuestro. Hoy el Módulo 9 no tiene
 * ninguno (sus códigos son genéricos); la tabla queda para cuando los agregue. Es el único
 * lugar donde se traducen.
 */
const MOTIVOS: Record<string, CodigoRechazo> = {
  YA_INSCRIPTO: 'YA_INSCRIPTO',
  SIN_CUPO: 'SIN_CUPO',
  CORRELATIVIDAD_FALTANTE: 'CORRELATIVIDAD_FALTANTE',
  SIN_REGULARIDAD: 'SIN_REGULARIDAD',
  FUERA_DE_FECHA: 'FUERA_DE_FECHA',
};

/** Códigos genéricos del Módulo 9 que son un rechazo de negocio, sin decir el motivo. */
const RECHAZOS_GENERICOS = new Set(['BUSINESS_RULE_VIOLATION', 'DATA_CONFLICT']);

/** Status con los que puede llegar un rechazo: el Módulo 9 no dijo cuál usa. */
const ESTADOS_RECHAZO = new Set([400, 409, 422]);

/**
 * 4xx del POST de inscripción → 409 `ProblemaInscripcion`, o null si no es un rechazo de
 * negocio (por ejemplo, un 400 `VALIDATION_ERROR` por un pedido mal armado, que es un 502).
 * Un motivo que no se reconoce es `INSCRIPCION_RECHAZADA` con el `detail` del Módulo 9. Un 409
 * siempre es un rechazo, aunque el cuerpo no se entienda.
 */
export function aRechazoInscripcion(estado: number, datos: unknown): ProblemaError | null {
  if (!ESTADOS_RECHAZO.has(estado)) return null;
  const parseo = ProblemaModulo.safeParse(datos);
  const { code, detail } = parseo.success ? parseo.data : { code: undefined, detail: undefined };
  const motivo = code !== undefined && Object.hasOwn(MOTIVOS, code) ? MOTIVOS[code]! : null;
  const generico = code !== undefined && RECHAZOS_GENERICOS.has(code);
  if (!motivo && !generico && estado !== 409) return null;
  return new ProblemaError(409, motivo ?? 'INSCRIPCION_RECHAZADA', 'Inscripción rechazada', {
    modulo: 'GESTION_ACADEMICA',
    ...(detail !== undefined && { detail }),
  });
}
