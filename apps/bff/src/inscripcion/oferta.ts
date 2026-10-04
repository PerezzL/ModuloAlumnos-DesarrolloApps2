import type { Comision, MateriaOferta, OfertaInscripcion } from '@uadenet/api-types';
import { ProblemaError } from '../comun/problema';
import type {
  Correlativa,
  CursoOfertado,
  InscripcionAlumno,
  PeriodoAcademico,
} from '../modulos/academico/academico.modelo';

const periodoNoEncontrado = (detail: string) =>
  new ProblemaError(404, 'PERIODO_NO_ENCONTRADO', 'Período no encontrado', { detail });

const ms = (instante?: string) => (instante === undefined ? NaN : Date.parse(instante));

/** Si `ahora` está dentro de la ventana de inscripción del período (ambos extremos inclusive). */
export function inscripcionAbierta(periodo: PeriodoAcademico, ahora: Date): boolean {
  const t = ahora.getTime();
  return ms(periodo.inscripcionDesde) <= t && t <= ms(periodo.inscripcionHasta);
}

/**
 * Período de la oferta. Con `periodoId`, ese. Si no, el vigente: el que tiene la inscripción
 * abierta; si no hay, el próximo en abrir; si tampoco, el último que cerró (o el último de
 * la lista, si ninguno informa su ventana).
 */
export function elegirPeriodo(
  periodos: PeriodoAcademico[],
  ahora: Date,
  periodoId?: string,
): PeriodoAcademico {
  if (periodoId !== undefined) {
    const pedido = periodos.find((p) => p.id === periodoId);
    if (!pedido) throw periodoNoEncontrado(`No existe el período ${periodoId}`);
    return pedido;
  }
  if (periodos.length === 0) throw periodoNoEncontrado('Gestión Académica no informa períodos');

  const t = ahora.getTime();
  const abierto = periodos.find((p) => inscripcionAbierta(p, ahora));
  if (abierto) return abierto;
  const [proximo] = periodos
    .filter((p) => ms(p.inscripcionDesde) > t)
    .sort((a, b) => ms(a.inscripcionDesde) - ms(b.inscripcionDesde));
  if (proximo) return proximo;
  const [ultimo] = periodos
    .filter((p) => ms(p.inscripcionHasta) < t)
    .sort((a, b) => ms(b.inscripcionHasta) - ms(a.inscripcionHasta));
  return ultimo ?? periodos.at(-1)!;
}

/** Estados del alumno que cumplen cada tipo de correlativa */
const CUMPLE: Record<Correlativa['tipo'], ReadonlySet<InscripcionAlumno['estado']>> = {
  APROBADA: new Set(['APROBADO']),
  REGULAR: new Set(['REGULAR', 'APROBADO']),
};

/**
 * Correlativas que el alumno todavía no cumple, según su historial. `APROBADA` exige haber
 * aprobado la materia; `REGULAR` acepta tenerla regular o aprobada.
 */
export function correlativasFaltantes(
  correlativas: Correlativa[],
  inscripciones: InscripcionAlumno[],
): Correlativa[] {
  return correlativas.filter(
    (c) =>
      !inscripciones.some(
        (i) => i.asignatura.id === c.asignaturaId && CUMPLE[c.tipo].has(i.estado),
      ),
  );
}

/** Estado de la comisión para el alumno: inscripto, bloqueada por correlativa o según cupo. */
function estadoComision(
  curso: CursoOfertado,
  inscripto: boolean,
  bloqueada: boolean,
): Comision['estado'] {
  if (inscripto) return 'INSCRIPTO';
  if (bloqueada) return 'BLOQUEADA';
  return curso.inscriptosActivos < curso.cupoMaximo ? 'CON_CUPO' : 'SIN_CUPO';
}

function comision(curso: CursoOfertado, inscripto: boolean, bloqueada: boolean): Comision {
  return {
    cursoId: curso.cursoId,
    ...(curso.nombre !== undefined && { nombre: curso.nombre }),
    cupoMaximo: curso.cupoMaximo,
    inscriptosActivos: curso.inscriptosActivos,
    estado: estadoComision(curso, inscripto, bloqueada),
  };
}

export interface DatosOferta {
  periodo: PeriodoAcademico;
  cursos: CursoOfertado[];
  /** Todas las inscripciones del alumno, de cualquier período */
  inscripciones: InscripcionAlumno[];
  /** Correlativas de cada asignatura de la oferta, por id de asignatura */
  correlativas: ReadonlyMap<string, Correlativa[]>;
  filtradaPorPlan: boolean;
  ahora: Date;
}

/** Agrupa las comisiones del período por asignatura, ordenadas por nombre de materia. */
export function armarOferta({
  periodo,
  cursos,
  inscripciones,
  correlativas,
  filtradaPorPlan,
  ahora,
}: DatosOferta): OfertaInscripcion {
  // Una baja no cuenta: el alumno puede volver a inscribirse
  const cursosInscriptos = new Set(
    inscripciones.filter((i) => i.estado !== 'BAJA').map((i) => i.cursoId),
  );
  const porAsignatura = new Map<string, MateriaOferta>();
  for (const curso of cursos) {
    let materia = porAsignatura.get(curso.asignatura.id);
    if (!materia) {
      const faltantes = correlativasFaltantes(
        correlativas.get(curso.asignatura.id) ?? [],
        inscripciones,
      );
      materia = {
        asignatura: curso.asignatura,
        bloqueada: faltantes.length > 0,
        ...(faltantes.length > 0 && { correlativasFaltantes: faltantes }),
        comisiones: [],
      };
      porAsignatura.set(curso.asignatura.id, materia);
    }
    materia.comisiones.push(
      comision(curso, cursosInscriptos.has(curso.cursoId), materia.bloqueada),
    );
  }

  const { inscripcionDesde, inscripcionHasta, ...datosPeriodo } = periodo;
  return {
    periodo: datosPeriodo,
    ...(inscripcionDesde !== undefined && { inscripcionDesde }),
    ...(inscripcionHasta !== undefined && { inscripcionHasta }),
    inscripcionAbierta: inscripcionAbierta(periodo, ahora),
    filtradaPorPlan,
    materias: [...porAsignatura.values()].sort((a, b) =>
      a.asignatura.nombre.localeCompare(b.asignatura.nombre, 'es'),
    ),
  };
}
