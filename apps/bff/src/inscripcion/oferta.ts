import type { Comision, MateriaOferta, OfertaInscripcion } from '@uadenet/api-types';
import { ProblemaError } from '../comun/problema';
import type { CursoOfertado, PeriodoAcademico } from '../modulos/academico/academico.modelo';

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

function comision(curso: CursoOfertado): Comision {
  return {
    cursoId: curso.cursoId,
    ...(curso.nombre !== undefined && { nombre: curso.nombre }),
    cupoMaximo: curso.cupoMaximo,
    inscriptosActivos: curso.inscriptosActivos,
    estado: curso.inscriptosActivos < curso.cupoMaximo ? 'CON_CUPO' : 'SIN_CUPO',
  };
}

export interface DatosOferta {
  periodo: PeriodoAcademico;
  cursos: CursoOfertado[];
  filtradaPorPlan: boolean;
  ahora: Date;
}

/** Agrupa las comisiones del período por asignatura, ordenadas por nombre de materia. */
export function armarOferta({
  periodo,
  cursos,
  filtradaPorPlan,
  ahora,
}: DatosOferta): OfertaInscripcion {
  const porAsignatura = new Map<string, MateriaOferta>();
  for (const curso of cursos) {
    let materia = porAsignatura.get(curso.asignatura.id);
    if (!materia) {
      materia = { asignatura: curso.asignatura, bloqueada: false, comisiones: [] };
      porAsignatura.set(curso.asignatura.id, materia);
    }
    materia.comisiones.push(comision(curso));
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
