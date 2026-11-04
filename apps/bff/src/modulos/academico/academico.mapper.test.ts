import { describe, expect, it } from 'vitest';
import { fixture } from '../../../test/fixtures';
import { ProblemaError } from '../../comun/problema';
import {
  aCarreras,
  aCorrelativas,
  aCursos,
  aInscripcion,
  aInscripciones,
  aPeriodos,
  aRechazoInscripcion,
  turnosAItems,
} from './academico.mapper';

const turnos = fixture('academic/turnos-examen.provisional.json');
const octubre = { desde: '2026-10-01', hasta: '2026-10-31' };

describe('mapper de Gestión Académica: turnos de examen → calendario', () => {
  it('cada turno del rango es un ítem de todo el día con su ventana', () => {
    expect(turnosAItems(turnos, octubre)).toEqual([
      {
        id: 'EXAMEN:turno-2026-10',
        categoria: 'EXAMEN',
        titulo: 'Mesa especial de octubre 2026',
        inicio: '2026-10-19T00:00:00-03:00',
        fin: '2026-10-23T00:00:00-03:00',
        todoElDia: true,
        lugar: null,
      },
    ]);
  });

  it('incluye un turno que empieza antes del rango y termina adentro', () => {
    const items = turnosAItems(turnos, { desde: '2027-03-01', hasta: '2027-03-31' });
    expect(items.map((i) => i.id)).toEqual(['EXAMEN:turno-2027-02']);
  });

  it('sin turnos en el rango, lista vacía', () => {
    expect(turnosAItems(turnos, { desde: '2026-01-01', hasta: '2026-01-31' })).toEqual([]);
  });

  it('una fecha con formato inesperado es 502 de GESTION_ACADEMICA', () => {
    expect(() =>
      turnosAItems(
        [{ id: 't', nombre: 'x', fechaInicio: '07/12/2026', fechaFin: '19/12/2026' }],
        octubre,
      ),
    ).toThrow(ProblemaError);
    try {
      turnosAItems({}, octubre);
    } catch (e) {
      expect((e as ProblemaError).aProblema()).toMatchObject({
        status: 502,
        modulo: 'GESTION_ACADEMICA',
      });
    }
  });
});

describe('mapper de Gestión Académica: datos para la inscripción', () => {
  it('períodos con su ventana de inscripción', () => {
    const periodos = aPeriodos(fixture('academic/periodos.provisional.json'));
    expect(periodos.at(-1)).toEqual({
      id: '2027-1',
      nombre: '1° cuatrimestre 2027',
      inscripcionDesde: '2026-09-28T12:00:00.000Z',
      inscripcionHasta: '2026-12-19T02:59:59.000Z',
    });
  });

  it('un período sin ventana no la inventa', () => {
    expect(aPeriodos([{ id: 7, nombre: 'Verano' }])).toEqual([{ id: '7', nombre: 'Verano' }]);
  });

  it('cursos con asignatura anidada, cupo y nombre de comisión', () => {
    const cursos = aCursos(fixture('academic/cursos.provisional.json'));
    expect(cursos.find((c) => c.cursoId === 'curso-so-2027-1-a')).toEqual({
      cursoId: 'curso-so-2027-1-a',
      nombre: 'A - Noche',
      sede: 'Monserrat',
      horarios: [
        { dia: 'LUNES', desde: '18:30', hasta: '20:30', aula: 'Aula 501' },
        { dia: 'VIERNES', desde: '18:30', hasta: '20:30', aula: 'Aula 501' },
      ],
      cupoMaximo: 45,
      inscriptosActivos: 10,
      asignatura: { id: 'asig-so', codigo: '3.4.074', nombre: 'Sistemas Operativos' },
    });
  });

  it('sin horarios ni sede, la comisión sale igual: horarios vacíos y sede null', () => {
    const cursos = aCursos(fixture('academic/cursos.provisional.json'));
    expect(cursos.find((c) => c.cursoId === 'curso-desa2-2027-1-a')).toMatchObject({
      horarios: [],
    });
    const [curso] = aCursos([
      { id: 'c', cupoMaximo: 1, inscriptosActivos: 0, asignatura: { id: 'a', nombre: 'A' } },
    ]);
    expect(curso).toMatchObject({ sede: null, horarios: [] });
  });

  it('un horario sin aula la deja en null', () => {
    const [curso] = aCursos([
      {
        id: 'c',
        cupoMaximo: 1,
        inscriptosActivos: 0,
        asignatura: { id: 'a', nombre: 'A' },
        horarios: [{ dia: 'SABADO', desde: '09:00', hasta: '13:00' }],
      },
    ]);
    expect(curso!.horarios).toEqual([
      { dia: 'SABADO', desde: '09:00', hasta: '13:00', aula: null },
    ]);
  });

  it('un horario con un día desconocido es 502', () => {
    expect(() =>
      aCursos([
        {
          id: 'c',
          cupoMaximo: 1,
          inscriptosActivos: 0,
          asignatura: { id: 'a', nombre: 'A' },
          horarios: [{ dia: 'DOMINGO', desde: '09:00', hasta: '13:00' }],
        },
      ]),
    ).toThrow(ProblemaError);
  });

  it('ids numéricos se tratan como strings opacos', () => {
    const [curso] = aCursos([
      { id: 42, cupoMaximo: 1, inscriptosActivos: 0, asignatura: { id: 9, nombre: 'X' } },
    ]);
    expect(curso).toMatchObject({ cursoId: '42', asignatura: { id: '9', nombre: 'X' } });
  });

  it('correlatividades', () => {
    const todas = fixture<Record<string, unknown>>('academic/correlatividades.provisional.json');
    expect(aCorrelativas(todas['asig-so'])).toEqual([
      { asignaturaId: 'asig-prog2', nombre: 'Programación II', tipo: 'REGULAR' },
      { asignaturaId: 'asig-discreta', nombre: 'Matemática Discreta', tipo: 'APROBADA' },
    ]);
  });

  it('inscripciones del alumno; la nota final no se toma de acá (sale del Módulo 2)', () => {
    const inscripciones = aInscripciones(fixture('academic/inscripciones-alumno.provisional.json'));
    expect(inscripciones[0]).toEqual({
      cursoId: 'curso-prog1-2025-2-a',
      comision: 'A - Noche',
      asignatura: { id: 'asig-prog1', codigo: '3.4.069', nombre: 'Programación I' },
      periodo: { id: '2025-2', nombre: '2° cuatrimestre 2025' },
      estado: 'APROBADO',
      fecha: '2025-07-22T13:10:00.000Z',
    });
  });

  it('un estado desconocido es 502 de GESTION_ACADEMICA', () => {
    const [inscripcion] = fixture<object[]>('academic/inscripciones-alumno.provisional.json');
    expect(() => aInscripciones([{ ...inscripcion, estado: 'PROMOCIONADO' }])).toThrow(
      ProblemaError,
    );
  });
});

describe('mapper de Gestión Académica: inscripción creada', () => {
  it('201 del Módulo 9 → Inscripcion (sin el alumnoId)', () => {
    expect(aInscripcion(fixture('academic/inscripcion-creada.provisional.json'))).toEqual({
      id: 'c0a8f3d2-5b1e-4f6a-9d7c-2e3f4a5b6c7d',
      cursoId: 'curso-so-2027-1-a',
      estado: 'INSCRIPTO',
      fecha: '2026-10-04T15:00:00.000Z',
    });
  });

  it('sin id ni fecha, no los inventa', () => {
    expect(aInscripcion({ cursoId: 5, estado: 'INSCRIPTO' })).toEqual({
      cursoId: '5',
      estado: 'INSCRIPTO',
    });
  });
});

describe('mapper de Gestión Académica: rechazos de la inscripción', () => {
  const rechazos = fixture<Record<string, unknown>>(
    'academic/inscripcion-rechazos.provisional.json',
  );
  const problema = (motivo: string) => aRechazoInscripcion(rechazos[motivo]).aProblema();

  it.each(['YA_INSCRIPTO', 'SIN_CUPO', 'SIN_REGULARIDAD', 'FUERA_DE_FECHA'])(
    '%s → 409 con el mismo code',
    (motivo) => {
      expect(problema(motivo)).toMatchObject({
        status: 409,
        code: motivo,
        modulo: 'GESTION_ACADEMICA',
      });
      expect(problema(motivo)).not.toHaveProperty('correlativasFaltantes');
    },
  );

  it('CORRELATIVIDAD_FALTANTE trae las correlativas que faltan', () => {
    expect(problema('CORRELATIVIDAD_FALTANTE')).toMatchObject({
      status: 409,
      code: 'CORRELATIVIDAD_FALTANTE',
      correlativasFaltantes: [
        { asignaturaId: 'asig-desa1', nombre: 'Desarrollo de Aplicaciones I', tipo: 'REGULAR' },
      ],
    });
  });

  it('un motivo desconocido es INSCRIPCION_RECHAZADA, con el detalle del módulo', () => {
    expect(problema('DESCONOCIDO')).toMatchObject({
      status: 409,
      code: 'INSCRIPCION_RECHAZADA',
      detail: 'El alumno registra deuda',
    });
  });

  it('un cuerpo que no se entiende también es INSCRIPCION_RECHAZADA', () => {
    for (const cuerpo of ['texto plano', null, { code: 42 }]) {
      expect(aRechazoInscripcion(cuerpo).aProblema()).toMatchObject({
        status: 409,
        code: 'INSCRIPCION_RECHAZADA',
      });
    }
  });
});

describe('mapper de Gestión Académica: carreras', () => {
  it('arma el nombre por id, con el id como string opaco', () => {
    const carreras = aCarreras(fixture('academic/carreras.provisional.json'));
    expect(carreras.get('3')).toBe('Ingeniería en Informática');
    expect(carreras.has('99')).toBe(false);
  });

  it('una carrera sin nombre es 502 de Gestión Académica', () => {
    expect(() => aCarreras([{ id: 3 }])).toThrow(ProblemaError);
  });
});
