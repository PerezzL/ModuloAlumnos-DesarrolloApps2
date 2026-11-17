import { describe, expect, it } from 'vitest';
import { fixture } from '../../../test/fixtures';
import { ProblemaError } from '../../comun/problema';
import {
  aAsignaturasPlan,
  aCarreras,
  aCorrelativas,
  aCursos,
  aInscripcion,
  aInscripciones,
  aPeriodos,
  aPlanesActivos,
  aRechazoInscripcion,
  turnosAItems,
} from './academico.mapper';

const turnos = fixture('academic/turnos-examen.provisional.json');
const octubre = { desde: '2026-10-01', hasta: '2026-10-31' };

const es502 = (llamada: () => unknown) => {
  expect(llamada).toThrow(ProblemaError);
  try {
    llamada();
  } catch (e) {
    expect((e as ProblemaError).aProblema()).toMatchObject({
      status: 502,
      modulo: 'GESTION_ACADEMICA',
    });
  }
};

describe('mapper de Gestión Académica: turnos de examen → calendario', () => {
  it('cada turno del rango es un ítem de todo el día con su ventana', () => {
    expect(turnosAItems(turnos, octubre)).toEqual([
      {
        id: 'EXAMEN:30',
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
    expect(items.map((i) => i.id)).toEqual(['EXAMEN:32']);
  });

  it('sin turnos en el rango, lista vacía', () => {
    expect(turnosAItems(turnos, { desde: '2026-01-01', hasta: '2026-01-31' })).toEqual([]);
  });

  it('una fecha con formato inesperado es 502 de GESTION_ACADEMICA', () => {
    es502(() =>
      turnosAItems(
        [{ id: 1, nombre: 'x', fechaInicio: '07/12/2026', fechaFin: '19/12/2026' }],
        octubre,
      ),
    );
    es502(() => turnosAItems({}, octubre));
  });
});

describe('mapper de Gestión Académica: períodos', () => {
  const periodos = aPeriodos(fixture('academic/periodos.provisional.json'));

  it('arma el nombre con número y año, y la ventana completa en hora de Argentina', () => {
    expect(periodos.at(-1)).toEqual({
      id: '4',
      nombre: '1° cuatrimestre 2027',
      inscripcionDesde: '2026-09-28T00:00:00-03:00',
      inscripcionHasta: '2026-12-18T23:59:59.999-03:00',
    });
  });

  it('un período sin ventana no la inventa', () => {
    const [periodo] = aPeriodos([
      { id: 7, anio: 2027, numero: 3, fechaInicio: '2027-01-04', fechaFin: '2027-02-26' },
    ]);
    expect(periodo).toEqual({ id: '7', nombre: '3° cuatrimestre 2027' });
  });

  it('una ventana con hora (no es la forma del Módulo 9) es 502', () => {
    es502(() =>
      aPeriodos([
        {
          id: 7,
          anio: 2027,
          numero: 1,
          fechaInicio: '2027-03-15',
          fechaFin: '2027-07-10',
          inscripcionDesde: '2026-09-28T12:00:00Z',
        },
      ]),
    );
  });
});

describe('mapper de Gestión Académica: cursos y materias del plan', () => {
  const cursos = aCursos(fixture('academic/cursos.provisional.json'));
  const curso = (extra: object) => ({
    id: 1,
    codigo: 'A',
    asignaturaId: 9,
    estado: 'PLANIFICADO',
    cupoMaximo: 1,
    inscriptosActivos: 0,
    ...extra,
  });

  it('comisión con su código, sede, cupo y el horario traducido al contrato', () => {
    expect(cursos.find((c) => c.cursoId === '1009')).toEqual({
      cursoId: '1009',
      asignaturaId: '107',
      nombre: 'A - Noche',
      sede: 'Sede Monserrat',
      horarios: [{ dia: 'LUNES', desde: '18:30', hasta: '22:30', aula: 'Aula 501' }],
      cupoMaximo: 45,
      inscriptosActivos: 10,
    });
  });

  it('sin horario ni sede, la comisión sale igual: horarios vacíos y sede null', () => {
    expect(cursos.find((c) => c.cursoId === '1010')).toMatchObject({ horarios: [] });
    expect(aCursos([curso({})])[0]).toMatchObject({ sede: null, horarios: [] });
  });

  it('un horario sin aula la deja en null', () => {
    const [c] = aCursos([
      curso({ diaSemana: 'SATURDAY', horaInicio: '09:00:00', horaFin: '13:00:00' }),
    ]);
    expect(c!.horarios).toEqual([{ dia: 'SABADO', desde: '09:00', hasta: '13:00', aula: null }]);
  });

  it('un día fuera de lunes a sábado es 502', () => {
    es502(() =>
      aCursos([curso({ diaSemana: 'SUNDAY', horaInicio: '09:00:00', horaFin: '13:00:00' })]),
    );
  });

  it('no ofrece comisiones canceladas ni finalizadas', () => {
    const ids = cursos.map((c) => c.cursoId);
    expect(ids).not.toContain('1012');
    expect(ids).not.toContain('1001');
    expect(aCursos([curso({ estado: 'EN_CURSO' })])).toHaveLength(1);
  });

  it('un estado desconocido es 502', () => {
    es502(() => aCursos([curso({ estado: 'SUSPENDIDO' })]));
  });

  it('ids numéricos se tratan como strings opacos', () => {
    expect(aCursos([curso({ id: 42, asignaturaId: 9 })])[0]).toMatchObject({
      cursoId: '42',
      asignaturaId: '9',
    });
  });

  it('materias del plan con id, código y nombre', () => {
    const planes = fixture<Record<string, unknown>>('academic/planes-asignaturas.provisional.json');
    expect(aAsignaturasPlan(planes['12'])[0]).toEqual({
      id: '101',
      codigo: '3.4.069',
      nombre: 'Programación I',
    });
  });
});

describe('mapper de Gestión Académica: correlatividades', () => {
  const todas = fixture<Record<string, unknown>>('academic/correlatividades.provisional.json');

  it('aplana las condiciones: una correlativa por materia, con su tipo', () => {
    expect(aCorrelativas(todas['107'])).toEqual([
      { asignaturaId: '104', nombre: 'Programación II', tipo: 'REGULAR' },
      { asignaturaId: '102', nombre: 'Matemática Discreta', tipo: 'APROBADA' },
    ]);
  });

  it('sin condiciones, sin correlativas', () => {
    expect(aCorrelativas(todas['101'])).toEqual([]);
  });

  it('la forma vieja (una lista suelta) es 502', () => {
    es502(() => aCorrelativas([{ asignaturaId: 1, nombre: 'x', tipo: 'REGULAR' }]));
  });
});

describe('mapper de Gestión Académica: inscripciones del alumno', () => {
  const datos = fixture<object[]>('academic/inscripciones-alumno.provisional.json');

  it('toma curso, asignatura y período del curso anidado; la nota final no se toma de acá', () => {
    expect(aInscripciones(datos)[0]).toEqual({
      cursoId: '1001',
      comision: 'A - Noche',
      asignatura: { id: '101', codigo: '3.4.069', nombre: 'Programación I' },
      periodo: { id: '1', nombre: '2° cuatrimestre 2025' },
      inicioPeriodo: '2025-08-11',
      estado: 'APROBADO',
      fecha: '2025-07-22',
    });
  });

  it('un estado desconocido es 502', () => {
    es502(() => aInscripciones([{ ...datos[0], estado: 'PROMOCIONADO' }]));
  });

  it('sin curso anidado es 502', () => {
    const { curso: _curso, ...sinCurso } = datos[0] as Record<string, unknown>;
    es502(() => aInscripciones([sinCurso]));
  });
});

describe('mapper de Gestión Académica: inscripción creada', () => {
  it('201 del Módulo 9 → Inscripcion, con el curso que se pidió', () => {
    expect(aInscripcion(fixture('academic/inscripcion-creada.provisional.json'), '1009')).toEqual({
      id: '5007',
      cursoId: '1009',
      estado: 'INSCRIPTO',
      fecha: '2026-10-04',
    });
  });

  it('sin fecha, no la inventa', () => {
    expect(aInscripcion({ id: 5, estado: 'INSCRIPTO' }, '1')).toEqual({
      id: '5',
      cursoId: '1',
      estado: 'INSCRIPTO',
    });
  });
});

describe('mapper de Gestión Académica: rechazos de la inscripción', () => {
  const rechazos = fixture<Record<string, { status: number; detail: string }>>(
    'academic/inscripcion-rechazos.provisional.json',
  );

  it.each(Object.keys(rechazos))(
    '%s (código genérico) → 409 INSCRIPCION_RECHAZADA con el detalle del Módulo 9',
    (caso) => {
      const { status, detail } = rechazos[caso]!;
      expect(aRechazoInscripcion(status, rechazos[caso])?.aProblema()).toMatchObject({
        status: 409,
        code: 'INSCRIPCION_RECHAZADA',
        detail,
        modulo: 'GESTION_ACADEMICA',
      });
    },
  );

  it('si el Módulo 9 agrega un código con el motivo, se usa el nuestro', () => {
    expect(aRechazoInscripcion(422, { code: 'SIN_CUPO' })?.aProblema()).toMatchObject({
      status: 409,
      code: 'SIN_CUPO',
    });
  });

  it('un 409 siempre es un rechazo, aunque el cuerpo no se entienda', () => {
    for (const cuerpo of ['texto plano', null, { code: 42 }, { code: 'OTRO' }]) {
      expect(aRechazoInscripcion(409, cuerpo)?.aProblema()).toMatchObject({
        status: 409,
        code: 'INSCRIPCION_RECHAZADA',
      });
    }
  });

  it('un error de validación o un status que no es de rechazo no es un rechazo', () => {
    expect(aRechazoInscripcion(400, { code: 'VALIDATION_ERROR' })).toBeNull();
    expect(aRechazoInscripcion(422, { code: 'OTRO' })).toBeNull();
    expect(aRechazoInscripcion(403, { code: 'BUSINESS_RULE_VIOLATION' })).toBeNull();
  });
});

describe('mapper de Gestión Académica: carreras', () => {
  const carreras = fixture('academic/carreras.provisional.json');

  it('arma el nombre por id, con el id como string opaco', () => {
    const nombres = aCarreras(carreras);
    expect(nombres.get('3')).toBe('Ingeniería en Informática');
    expect(nombres.has('99')).toBe(false);
  });

  it('el plan activo por carrera; sin plan activo, no figura', () => {
    expect(aPlanesActivos(carreras).get('3')).toBe('12');
    const sinPlan = aPlanesActivos([{ id: 8, nombre: 'Nueva', ultimoPlanActivo: null }]);
    expect(sinPlan.has('8')).toBe(false);
  });

  it('una carrera sin nombre es 502 de Gestión Académica', () => {
    es502(() => aCarreras([{ id: 3 }]));
  });
});
