import { Router } from 'express';
import { fixture } from '../fixtures.js';
import { enviarProblema } from '../problema.js';
import { ALUMNO_DEMO } from './comun.js';

type Id = number;

interface AsignaturaRef {
  id: Id;
  codigo: string;
  nombre: string;
}

interface Periodo {
  id: Id;
  anio: number;
  numero: number;
  fechaInicio: string;
  fechaFin: string;
  inscripcionDesde: string;
  inscripcionHasta: string;
}

interface Curso {
  id: Id;
  codigo: string;
  asignaturaId: Id;
  periodoId: Id;
  cupoMaximo: number;
  inscriptosActivos: number;
  [campo: string]: unknown;
}

interface Inscripcion {
  id: Id;
  alumnoId: string;
  fechaInscripcion: string;
  estado: string;
  notaFinal: number | null;
  fechaResultado: string | null;
  curso: Omit<Curso, 'asignaturaId' | 'periodoId'> & {
    asignatura: AsignaturaRef;
    periodo: Periodo;
  };
}

interface Correlatividades {
  asignaturaId: Id;
  condiciones: { tipo: 'REGULAR' | 'APROBADA'; materiasCorrelativas: AsignaturaRef[] }[];
}

const ACTIVAS = new Set(['INSCRIPTO', 'CURSANDO']);
const DIA_MS = 24 * 60 * 60 * 1000;
const CUMPLE: Record<'REGULAR' | 'APROBADA', Set<string>> = {
  APROBADA: new Set(['APROBADO']),
  REGULAR: new Set(['REGULAR', 'APROBADO']),
};
const QUE_FALTA = { APROBADA: 'aprobar', REGULAR: 'regularizar' } as const;

/** `YYYY-MM-DD` de un instante, en hora de Argentina (-03:00, sin horario de verano). */
const diaArgentina = (ms: number) => new Date(ms - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Si hoy (en Argentina) está dentro de la ventana de inscripción, ambos días inclusive. */
const estaAbierto = (p: Periodo, ahora: number) => {
  const hoy = diaArgentina(ahora);
  return p.inscripcionDesde <= hoy && hoy <= p.inscripcionHasta;
};

/**
 * Módulo 9, con las formas de su documento y de su pedido a CORE (fixtures
 * `academic/*.provisional.json`), y estado en memoria: una inscripción hecha suma un inscripto
 * al curso y aparece en las inscripciones del alumno. Con `inscripcionCerrada`
 * (`/__falso/inscripcion`) se simula que ningún período tiene la inscripción abierta.
 * `reiniciar()` vuelve a las fixtures. Los rechazos usan los `code` genéricos del Módulo 9; el
 * status (409 o 422) es una suposición nuestra.
 */
export class EstadoAcademico {
  cursos: Curso[] = [];
  inscripciones = new Map<string, Inscripcion[]>();
  inscripcionCerrada = false;
  private siguienteId = 6000;

  constructor() {
    this.reiniciar();
  }

  reiniciar() {
    this.inscripcionCerrada = false;
    this.siguienteId = 6000;
    this.cursos = fixture<Curso[]>('academic/cursos.provisional.json');
    this.inscripciones = new Map([
      [ALUMNO_DEMO, fixture<Inscripcion[]>('academic/inscripciones-alumno.provisional.json')],
    ]);
  }

  inscripcionesDe(alumnoId: string) {
    return this.inscripciones.get(alumnoId) ?? [];
  }

  nuevoId() {
    return this.siguienteId++;
  }

  /**
   * Los períodos de la fixture. Con la inscripción cerrada simulada, el que hoy está abierto
   * pasa a abrir en una semana (y a durar al menos dos), así el portal lo ve como próximo.
   */
  periodos(): Periodo[] {
    const periodos = fixture<Periodo[]>('academic/periodos.provisional.json');
    if (!this.inscripcionCerrada) return periodos;
    const ahora = Date.now();
    return periodos.map((p) => {
      if (!estaAbierto(p, ahora)) return p;
      const desde = diaArgentina(ahora + 7 * DIA_MS);
      const minimo = diaArgentina(ahora + 21 * DIA_MS);
      return {
        ...p,
        inscripcionDesde: desde,
        inscripcionHasta: p.inscripcionHasta > minimo ? p.inscripcionHasta : minimo,
      };
    });
  }
}

export function moduloAcademico(estado: EstadoAcademico) {
  const router = Router();
  const correlatividades = () =>
    fixture<Record<string, Correlatividades>>('academic/correlatividades.provisional.json');
  const planes = () =>
    fixture<Record<string, (AsignaturaRef & Record<string, unknown>)[]>>(
      'academic/planes-asignaturas.provisional.json',
    );
  const asignaturaRef = (id: Id): AsignaturaRef => {
    const a = Object.values(planes())
      .flat()
      .find((x) => x.id === id);
    return a ? { id: a.id, codigo: a.codigo, nombre: a.nombre } : { id, codigo: '', nombre: '' };
  };

  router.get('/api/v1/academica/carreras', (_req, res) => {
    res.json(fixture('academic/carreras.provisional.json'));
  });

  router.get('/api/v1/academica/carreras/con-ultimo-plan-activo', (_req, res) => {
    res.json(fixture('academic/carreras.provisional.json'));
  });

  router.get('/api/v1/academica/planes/:planId/asignaturas', (req, res) => {
    const todos = planes();
    if (!Object.hasOwn(todos, req.params.planId)) {
      return enviarProblema(res, 404, 'RESOURCE_NOT_FOUND', 'Plan inexistente');
    }
    res.json(todos[req.params.planId]);
  });

  router.get('/api/v1/planificacion/periodos', (_req, res) => {
    res.json(estado.periodos());
  });

  router.get('/api/v1/planificacion/turnos-examen', (_req, res) => {
    res.json(fixture('academic/turnos-examen.provisional.json'));
  });

  /** Como el Módulo 9: filtra solo por período, no por plan. */
  router.get('/api/v1/planificacion/cursos', (req, res) => {
    const { periodoId } = req.query;
    res.json(
      estado.cursos.filter((c) => periodoId === undefined || String(c.periodoId) === periodoId),
    );
  });

  router.get('/api/v1/academica/asignaturas/:asignaturaId/correlatividades', (req, res) => {
    const todas = correlatividades();
    const id = req.params.asignaturaId;
    if (!Object.hasOwn(todas, id)) {
      return enviarProblema(res, 404, 'RESOURCE_NOT_FOUND', 'Asignatura inexistente');
    }
    res.json(todas[id]);
  });

  router.get('/api/v1/planificacion/alumnos/:alumnoId/inscripciones', (req, res) => {
    const { periodoId } = req.query;
    res.json(
      estado
        .inscripcionesDe(req.params.alumnoId)
        .filter((i) => periodoId === undefined || String(i.curso.periodo.id) === periodoId),
    );
  });

  router.post('/api/v1/planificacion/cursos/:cursoId/inscripciones', (req, res) => {
    const { alumnoId } = (req.body ?? {}) as { alumnoId?: unknown };
    if (typeof alumnoId !== 'string' || !alumnoId) {
      return enviarProblema(res, 400, 'VALIDATION_ERROR', 'alumnoId es obligatorio');
    }
    const curso = estado.cursos.find((c) => String(c.id) === req.params.cursoId);
    if (!curso) return enviarProblema(res, 404, 'RESOURCE_NOT_FOUND', 'Curso inexistente');
    const rechazo = (detail: string) =>
      enviarProblema(res, 422, 'BUSINESS_RULE_VIOLATION', 'Unprocessable Entity', { detail });
    if (estado.inscripcionCerrada) return rechazo('La inscripción del período no está abierta');

    const previas = estado.inscripcionesDe(alumnoId);
    const yaInscripto = previas.some(
      (i) =>
        i.curso.id === curso.id ||
        (i.curso.asignatura.id === curso.asignaturaId && ACTIVAS.has(i.estado)),
    );
    if (yaInscripto) {
      return enviarProblema(res, 409, 'DATA_CONFLICT', 'Conflict', {
        detail: 'El alumno ya está inscripto en la asignatura',
      });
    }

    const condiciones = correlatividades()[String(curso.asignaturaId)]?.condiciones ?? [];
    const faltantes = condiciones.flatMap((c) =>
      c.materiasCorrelativas
        .filter(
          (m) =>
            !previas.some((i) => i.curso.asignatura.id === m.id && CUMPLE[c.tipo].has(i.estado)),
        )
        .map((m) => `${QUE_FALTA[c.tipo]} ${m.nombre}`),
    );
    if (faltantes.length) return rechazo(`Falta ${faltantes.join(' y ')}`);
    if (curso.inscriptosActivos >= curso.cupoMaximo) {
      return rechazo('La comisión no tiene cupo disponible');
    }

    const periodo = estado.periodos().find((p) => p.id === curso.periodoId)!;
    const { asignaturaId, periodoId: _periodo, ...datosCurso } = curso;
    const inscripcion: Inscripcion = {
      id: estado.nuevoId(),
      alumnoId,
      fechaInscripcion: diaArgentina(Date.now()),
      estado: 'INSCRIPTO',
      notaFinal: null,
      fechaResultado: null,
      curso: { ...datosCurso, asignatura: asignaturaRef(asignaturaId), periodo },
    };
    curso.inscriptosActivos += 1;
    estado.inscripciones.set(alumnoId, [...previas, inscripcion]);
    const { curso: _curso, ...creada } = inscripcion;
    res.status(201).json(creada);
  });

  return router;
}
