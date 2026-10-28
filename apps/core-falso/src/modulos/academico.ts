import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { fixture } from '../fixtures.js';
import { enviarProblema } from '../problema.js';
import { ALUMNO_DEMO } from './comun.js';

interface Asignatura {
  id: string;
  codigo: string;
  nombre: string;
}

interface Curso {
  id: string;
  comision: string;
  periodoId: string;
  cupoMaximo: number;
  inscriptosActivos: number;
  asignatura: Asignatura;
}

interface Periodo {
  id: string;
  nombre: string;
}

interface PeriodoConFechas extends Periodo {
  inscripcionDesde: string;
  inscripcionHasta: string;
}

interface Inscripcion {
  id: string;
  cursoId: string;
  comision: string;
  asignatura: Asignatura;
  periodo: Periodo;
  notaFinal: number | null;
  estado: string;
  fecha: string;
}

interface Correlativa {
  asignaturaId: string;
  nombre: string;
  tipo: 'REGULAR' | 'APROBADA';
}

/** Todos los cursos de las fixtures son del plan del alumno demo (ver backoffice/users). */
const PLAN_DEMO = '12';
const ACTIVAS = new Set(['INSCRIPTO', 'CURSANDO']);
const DIA_MS = 24 * 60 * 60 * 1000;
const CUMPLE: Record<Correlativa['tipo'], Set<string>> = {
  APROBADA: new Set(['APROBADO']),
  REGULAR: new Set(['REGULAR', 'APROBADO']),
};

/**
 * Módulo 9, con estado en memoria: una inscripción hecha suma un inscripto al curso y
 * aparece en las inscripciones del alumno. Con `inscripcionCerrada` (`/__falso/inscripcion`) se
 * simula que ningún período tiene la inscripción abierta. `reiniciar()` vuelve a las fixtures.
 * Los `code` de error del POST están pendientes en el Módulo 9: usamos los de openapi.yaml.
 */
export class EstadoAcademico {
  cursos: Curso[] = [];
  inscripciones = new Map<string, Inscripcion[]>();
  inscripcionCerrada = false;

  constructor() {
    this.reiniciar();
  }

  reiniciar() {
    this.inscripcionCerrada = false;
    this.cursos = fixture<Curso[]>('academic/cursos.provisional.json');
    this.inscripciones = new Map([
      [ALUMNO_DEMO, fixture<Inscripcion[]>('academic/inscripciones-alumno.provisional.json')],
    ]);
  }

  inscripcionesDe(alumnoId: string) {
    return this.inscripciones.get(alumnoId) ?? [];
  }

  /**
   * Los períodos de la fixture. Con la inscripción cerrada simulada, el que hoy está abierto
   * pasa a abrir en una semana (y a durar al menos dos), así el portal lo ve como próximo.
   */
  periodos(): PeriodoConFechas[] {
    const periodos = fixture<PeriodoConFechas[]>('academic/periodos.provisional.json');
    if (!this.inscripcionCerrada) return periodos;
    const ahora = Date.now();
    return periodos.map((p) => {
      if (!estaAbierto(p, ahora)) return p;
      const desde = ahora + 7 * DIA_MS;
      const hasta = Math.max(Date.parse(p.inscripcionHasta), desde + 14 * DIA_MS);
      return {
        ...p,
        inscripcionDesde: new Date(desde).toISOString(),
        inscripcionHasta: new Date(hasta).toISOString(),
      };
    });
  }
}

const estaAbierto = (p: PeriodoConFechas, ahora: number) =>
  Date.parse(p.inscripcionDesde) <= ahora && ahora < Date.parse(p.inscripcionHasta);

export function moduloAcademico(estado: EstadoAcademico) {
  const router = Router();
  const correlatividades = () =>
    fixture<Record<string, Correlativa[]>>('academic/correlatividades.provisional.json');

  router.get('/api/v1/academica/carreras', (_req, res) => {
    res.json(fixture('academic/carreras.provisional.json'));
  });

  router.get('/api/v1/planificacion/periodos', (_req, res) => {
    res.json(estado.periodos());
  });

  router.get('/api/v1/planificacion/turnos-examen', (_req, res) => {
    res.json(fixture('academic/turnos-examen.provisional.json'));
  });

  router.get('/api/v1/planificacion/cursos', (req, res) => {
    const { periodoId, planId } = req.query;
    if (planId !== undefined && planId !== PLAN_DEMO) return res.json([]);
    res.json(estado.cursos.filter((c) => periodoId === undefined || c.periodoId === periodoId));
  });

  router.get('/api/v1/academica/asignaturas/:asignaturaId/correlatividades', (req, res) => {
    const todas = correlatividades();
    const id = req.params.asignaturaId;
    if (!Object.hasOwn(todas, id)) {
      return enviarProblema(res, 404, 'NOT_FOUND', 'Asignatura inexistente');
    }
    res.json(todas[id]);
  });

  router.get('/api/v1/planificacion/alumnos/:alumnoId/inscripciones', (req, res) => {
    const { periodoId } = req.query;
    res.json(
      estado
        .inscripcionesDe(req.params.alumnoId)
        .filter((i) => periodoId === undefined || i.periodo.id === periodoId),
    );
  });

  router.post('/api/v1/planificacion/cursos/:cursoId/inscripciones', (req, res) => {
    const { alumnoId } = (req.body ?? {}) as { alumnoId?: unknown };
    if (typeof alumnoId !== 'string' || !alumnoId) {
      return enviarProblema(res, 400, 'VALIDATION_ERROR', 'alumnoId es obligatorio');
    }
    const curso = estado.cursos.find((c) => c.id === req.params.cursoId);
    if (!curso) return enviarProblema(res, 404, 'NOT_FOUND', 'Curso inexistente');
    if (estado.inscripcionCerrada) {
      return enviarProblema(res, 409, 'FUERA_DE_FECHA', 'La inscripción no está abierta');
    }

    const previas = estado.inscripcionesDe(alumnoId);
    const yaInscripto = previas.some(
      (i) =>
        i.cursoId === curso.id ||
        (i.asignatura.id === curso.asignatura.id && ACTIVAS.has(i.estado)),
    );
    if (yaInscripto) {
      return enviarProblema(res, 409, 'YA_INSCRIPTO', 'Ya está inscripto en la asignatura');
    }

    const faltantes = (correlatividades()[curso.asignatura.id] ?? []).filter(
      (c) =>
        !previas.some((i) => i.asignatura.id === c.asignaturaId && CUMPLE[c.tipo].has(i.estado)),
    );
    if (faltantes.length) {
      return enviarProblema(res, 409, 'CORRELATIVIDAD_FALTANTE', 'Faltan correlativas', {
        correlativasFaltantes: faltantes,
      });
    }
    if (curso.inscriptosActivos >= curso.cupoMaximo) {
      return enviarProblema(res, 409, 'SIN_CUPO', 'La comisión no tiene cupo');
    }

    const periodo = estado.periodos().find((p) => p.id === curso.periodoId);
    const inscripcion: Inscripcion = {
      id: randomUUID(),
      cursoId: curso.id,
      comision: curso.comision,
      asignatura: curso.asignatura,
      periodo: { id: curso.periodoId, nombre: periodo?.nombre ?? curso.periodoId },
      notaFinal: null,
      estado: 'INSCRIPTO',
      fecha: new Date().toISOString(),
    };
    curso.inscriptosActivos += 1;
    estado.inscripciones.set(alumnoId, [...previas, inscripcion]);
    res.status(201).json({
      id: inscripcion.id,
      cursoId: curso.id,
      alumnoId,
      estado: inscripcion.estado,
      fecha: inscripcion.fecha,
    });
  });

  return router;
}
