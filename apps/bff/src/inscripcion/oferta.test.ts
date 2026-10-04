import { describe, expect, it } from 'vitest';
import { fixture } from '../../test/fixtures';
import { ProblemaError } from '../comun/problema';
import type { InscripcionAlumno } from '../modulos/academico/academico.modelo';
import {
  aCorrelativas,
  aCursos,
  aInscripciones,
  aPeriodos,
} from '../modulos/academico/academico.mapper';
import { armarOferta, correlativasFaltantes, elegirPeriodo } from './oferta';

const periodos = aPeriodos(fixture('academic/periodos.provisional.json'));
const cursos = aCursos(fixture('academic/cursos.provisional.json')).filter((c) =>
  c.cursoId.includes('2027-1'),
);
const historial = aInscripciones(fixture('academic/inscripciones-alumno.provisional.json'));
const correlatividades = new Map(
  Object.entries(
    fixture<Record<string, unknown>>('academic/correlatividades.provisional.json'),
  ).map(([id, datos]) => [id, aCorrelativas(datos)]),
);
const OCTUBRE = new Date('2026-10-04T15:00:00Z');

const inscripcionEn = (
  cursoId: string,
  estado: InscripcionAlumno['estado'],
): InscripcionAlumno => ({
  cursoId,
  asignatura: { id: 'x', nombre: 'x' },
  periodo: { id: '2027-1', nombre: '1° cuatrimestre 2027' },
  notaFinal: null,
  estado,
});

describe('período de la oferta', () => {
  it('sin periodoId, el que tiene la inscripción abierta', () => {
    expect(elegirPeriodo(periodos, OCTUBRE).id).toBe('2027-1');
  });

  it('si ninguno está abierto, el próximo en abrir', () => {
    expect(elegirPeriodo(periodos, new Date('2026-09-01T00:00:00Z')).id).toBe('2027-1');
    expect(elegirPeriodo(periodos, new Date('2026-05-01T00:00:00Z')).id).toBe('2026-2');
  });

  it('si no hay ninguno por abrir, el último que cerró', () => {
    expect(elegirPeriodo(periodos, new Date('2027-01-10T00:00:00Z')).id).toBe('2027-1');
  });

  it('con periodoId, ese aunque no esté abierto', () => {
    expect(elegirPeriodo(periodos, OCTUBRE, '2026-1').id).toBe('2026-1');
  });

  it('un periodoId desconocido o una lista vacía es 404 PERIODO_NO_ENCONTRADO', () => {
    for (const llamada of [
      () => elegirPeriodo(periodos, OCTUBRE, 'nada'),
      () => elegirPeriodo([], OCTUBRE),
    ]) {
      expect(llamada).toThrow(ProblemaError);
      try {
        llamada();
      } catch (e) {
        expect((e as ProblemaError).aProblema()).toMatchObject({
          status: 404,
          code: 'PERIODO_NO_ENCONTRADO',
        });
      }
    }
  });
});

describe('oferta agrupada por materia', () => {
  const periodo = elegirPeriodo(periodos, OCTUBRE);
  const oferta = armarOferta({
    periodo,
    cursos,
    inscripciones: historial,
    correlativas: correlatividades,
    filtradaPorPlan: true,
    ahora: OCTUBRE,
  });

  it('una materia por asignatura, ordenadas por nombre, con sus comisiones', () => {
    expect(oferta.materias.map((m) => m.asignatura.nombre)).toEqual([
      'Algoritmos y Estructuras de Datos',
      'Bases de Datos II',
      'Desarrollo de Aplicaciones II',
      'Sistemas Operativos',
    ]);
    const ayed = oferta.materias[0]!;
    expect(ayed.asignatura).toEqual({
      id: 'asig-ayed',
      codigo: '3.4.070',
      nombre: 'Algoritmos y Estructuras de Datos',
    });
    expect(ayed.comisiones.map((c) => c.nombre)).toEqual(['A - Mañana', 'B - Noche']);
  });

  it('el período sale sin la ventana; la ventana va aparte', () => {
    expect(oferta).toMatchObject({
      periodo: { id: '2027-1', nombre: '1° cuatrimestre 2027' },
      inscripcionDesde: '2026-09-28T12:00:00.000Z',
      inscripcionHasta: '2026-12-19T02:59:59.000Z',
      filtradaPorPlan: true,
    });
    expect(oferta.periodo).not.toHaveProperty('inscripcionDesde');
  });

  it('materias bloqueadas por correlativa, con las faltantes y comisiones BLOQUEADA', () => {
    const porNombre = Object.fromEntries(oferta.materias.map((m) => [m.asignatura.nombre, m]));
    expect(porNombre['Desarrollo de Aplicaciones II']).toMatchObject({
      bloqueada: true,
      correlativasFaltantes: [
        { asignaturaId: 'asig-desa1', nombre: 'Desarrollo de Aplicaciones I', tipo: 'REGULAR' },
      ],
      comisiones: [{ estado: 'BLOQUEADA' }],
    });
    expect(porNombre['Bases de Datos II']).toMatchObject({
      bloqueada: true,
      correlativasFaltantes: [{ asignaturaId: 'asig-bd1', tipo: 'APROBADA' }],
    });
    for (const nombre of ['Sistemas Operativos', 'Algoritmos y Estructuras de Datos']) {
      expect(porNombre[nombre]!.bloqueada).toBe(false);
      expect(porNombre[nombre]).not.toHaveProperty('correlativasFaltantes');
    }
  });

  it('cupo: con lugar CON_CUPO, lleno SIN_CUPO', () => {
    const ayed = oferta.materias[0]!.comisiones;
    expect(ayed.map((c) => [c.cursoId, c.estado])).toEqual([
      ['curso-ayed-2027-1-a', 'SIN_CUPO'],
      ['curso-ayed-2027-1-b', 'CON_CUPO'],
    ]);
  });

  it('sin cursos, sin materias', () => {
    expect(
      armarOferta({
        periodo,
        cursos: [],
        inscripciones: [],
        correlativas: new Map(),
        filtradaPorPlan: true,
        ahora: OCTUBRE,
      }).materias,
    ).toEqual([]);
  });

  const estados = (inscripciones: InscripcionAlumno[]) =>
    armarOferta({
      periodo,
      cursos,
      inscripciones,
      correlativas: new Map(),
      filtradaPorPlan: true,
      ahora: OCTUBRE,
    })
      .materias.flatMap((m) => m.comisiones)
      .reduce<Record<string, string>>((acc, c) => ({ ...acc, [c.cursoId]: c.estado }), {});

  it('INSCRIPTO sale de las inscripciones del alumno, aunque la comisión esté llena', () => {
    const resultado = estados([
      inscripcionEn('curso-so-2027-1-a', 'INSCRIPTO'),
      inscripcionEn('curso-ayed-2027-1-a', 'INSCRIPTO'),
    ]);
    expect(resultado['curso-so-2027-1-a']).toBe('INSCRIPTO');
    expect(resultado['curso-ayed-2027-1-a']).toBe('INSCRIPTO');
    expect(resultado['curso-ayed-2027-1-b']).toBe('CON_CUPO');
  });

  it('una inscripción dada de baja no cuenta', () => {
    expect(estados([inscripcionEn('curso-so-2027-1-a', 'BAJA')])['curso-so-2027-1-a']).toBe(
      'CON_CUPO',
    );
  });

  it('inscripciones de otros períodos no marcan comisiones de este', () => {
    expect(Object.values(estados(historial))).not.toContain('INSCRIPTO');
  });
});

describe('regla de correlatividad', () => {
  const correlativa = (tipo: 'REGULAR' | 'APROBADA') => ({
    asignaturaId: 'asig-prog2',
    nombre: 'Programación II',
    tipo,
  });
  const con = (estado: InscripcionAlumno['estado']) => [
    { ...inscripcionEn('c', estado), asignatura: { id: 'asig-prog2', nombre: 'Programación II' } },
  ];

  it.each([
    ['APROBADA', 'APROBADO', true],
    ['APROBADA', 'REGULAR', false],
    ['APROBADA', 'CURSANDO', false],
    ['REGULAR', 'REGULAR', true],
    ['REGULAR', 'APROBADO', true],
    ['REGULAR', 'CURSANDO', false],
    ['REGULAR', 'LIBRE', false],
    ['REGULAR', 'DESAPROBADO', false],
  ] as const)('tipo %s con la materia %s: cumple = %s', (tipo, estado, cumple) => {
    expect(correlativasFaltantes([correlativa(tipo)], con(estado))).toHaveLength(cumple ? 0 : 1);
  });

  it('sin haberla cursado, falta', () => {
    expect(correlativasFaltantes([correlativa('REGULAR')], [])).toHaveLength(1);
  });

  it('basta con un intento que la cumpla (la libre y después la regular)', () => {
    expect(
      correlativasFaltantes([correlativa('REGULAR')], [...con('LIBRE'), ...con('REGULAR')]),
    ).toEqual([]);
  });
});
