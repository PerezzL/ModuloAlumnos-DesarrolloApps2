import type {
  Asignatura,
  Inscripcion,
  ItemCalendario,
  ProblemaInscripcion,
} from '@uadenet/api-types';
import { inicioDelDia, type Rango, solapaDias } from '../../calendario/rango';
import { ProblemaError } from '../../comun/problema';
import { idOpaco, parsearOrigen } from '../comun';
import type {
  Correlativa,
  CursoOfertado,
  InscripcionAlumno,
  PeriodoAcademico,
} from './academico.modelo';
import {
  Correlatividades,
  Cursos,
  InscripcionCreada,
  InscripcionesAlumno,
  Periodos,
  RechazoInscripcion,
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

const asignatura = (a: { id: string | number; codigo?: string; nombre: string }): Asignatura => ({
  id: idOpaco(a.id),
  ...(a.codigo !== undefined && { codigo: a.codigo }),
  nombre: a.nombre,
});

export function aPeriodos(datos: unknown): PeriodoAcademico[] {
  return parsearOrigen('GESTION_ACADEMICA', Periodos, datos).map((p) => ({
    id: idOpaco(p.id),
    nombre: p.nombre,
    ...(p.inscripcionDesde !== undefined && { inscripcionDesde: p.inscripcionDesde }),
    ...(p.inscripcionHasta !== undefined && { inscripcionHasta: p.inscripcionHasta }),
  }));
}

export function aCursos(datos: unknown): CursoOfertado[] {
  return parsearOrigen('GESTION_ACADEMICA', Cursos, datos).map((c) => ({
    cursoId: idOpaco(c.id),
    ...(c.comision !== undefined && { nombre: c.comision }),
    sede: c.sede ?? null,
    horarios: (c.horarios ?? []).map((h) => ({
      dia: h.dia,
      desde: h.desde,
      hasta: h.hasta,
      aula: h.aula ?? null,
    })),
    cupoMaximo: c.cupoMaximo,
    inscriptosActivos: c.inscriptosActivos,
    asignatura: asignatura(c.asignatura),
  }));
}

export function aCorrelativas(datos: unknown): Correlativa[] {
  return parsearOrigen('GESTION_ACADEMICA', Correlatividades, datos).map((c) => ({
    asignaturaId: idOpaco(c.asignaturaId),
    nombre: c.nombre,
    tipo: c.tipo,
  }));
}

export function aInscripciones(datos: unknown): InscripcionAlumno[] {
  return parsearOrigen('GESTION_ACADEMICA', InscripcionesAlumno, datos).map((i) => ({
    cursoId: idOpaco(i.cursoId),
    ...(i.comision !== undefined && { comision: i.comision }),
    asignatura: asignatura(i.asignatura),
    periodo: { id: idOpaco(i.periodo.id), nombre: i.periodo.nombre },
    notaFinal: i.notaFinal ?? null,
    estado: i.estado,
    ...(i.fecha !== undefined && { fecha: i.fecha }),
  }));
}

export function aInscripcion(datos: unknown): Inscripcion {
  const i = parsearOrigen('GESTION_ACADEMICA', InscripcionCreada, datos);
  return {
    ...(i.id !== undefined && { id: idOpaco(i.id) }),
    cursoId: idOpaco(i.cursoId),
    estado: i.estado,
    ...(i.fecha !== undefined && { fecha: i.fecha }),
  };
}

type CodigoRechazo = NonNullable<ProblemaInscripcion['code']>;

/**
 * Motivo del Módulo 9 → nuestro `code`. Provisional: hasta tener sus códigos definitivos,
 * suponemos que usa los mismos nombres. Es el único lugar donde se traducen.
 */
const MOTIVOS: Record<string, CodigoRechazo> = {
  YA_INSCRIPTO: 'YA_INSCRIPTO',
  SIN_CUPO: 'SIN_CUPO',
  CORRELATIVIDAD_FALTANTE: 'CORRELATIVIDAD_FALTANTE',
  SIN_REGULARIDAD: 'SIN_REGULARIDAD',
  FUERA_DE_FECHA: 'FUERA_DE_FECHA',
};

/**
 * 409 del Módulo 9 → problem+json `ProblemaInscripcion`. Un motivo desconocido, o un cuerpo
 * que no se entiende, es `INSCRIPCION_RECHAZADA`: sigue siendo un rechazo, no un 502.
 */
export function aRechazoInscripcion(datos: unknown): ProblemaError {
  const rechazo = RechazoInscripcion.safeParse(datos);
  const cuerpo = rechazo.success ? rechazo.data : {};
  const code: CodigoRechazo =
    (cuerpo.code !== undefined && Object.hasOwn(MOTIVOS, cuerpo.code) && MOTIVOS[cuerpo.code]) ||
    'INSCRIPCION_RECHAZADA';
  const faltantes =
    code === 'CORRELATIVIDAD_FALTANTE'
      ? (cuerpo.correlativasFaltantes ?? []).map((c) => ({
          asignaturaId: idOpaco(c.asignaturaId),
          nombre: c.nombre,
          tipo: c.tipo,
        }))
      : undefined;
  return new ProblemaError(409, code, 'Inscripción rechazada', {
    modulo: 'GESTION_ACADEMICA',
    ...(cuerpo.detail !== undefined && { detail: cuerpo.detail }),
    ...(faltantes && { extra: { correlativasFaltantes: faltantes } }),
  });
}
