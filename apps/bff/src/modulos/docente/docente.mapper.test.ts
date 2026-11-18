import { describe, expect, it } from 'vitest';
import { fixture } from '../../../test/fixtures';
import { ProblemaError } from '../../comun/problema';
import { aAsistencia, aNotasCurso, aNotasFinales } from './docente.mapper';

const DEMO = 'ba310c57-a684-4dbf-a4a4-905fcfbefa08';
const asistencias = fixture<Record<string, Record<string, unknown>>>('teacher/attendance.json');
const bd1 = asistencias['1005']!;
const notas = fixture<Record<string, { exams: Record<string, unknown>[] }>>('teacher/grades.json');
const notasDesa1 = notas['1006']!;
const examen = notasDesa1.exams[0]!;
const resultados = fixture<Record<string, unknown[]>>('teacher/results.json')[DEMO]!;

const error502 = (fn: () => unknown) => {
  try {
    fn();
    expect.unreachable();
  } catch (e) {
    expect(e).toBeInstanceOf(ProblemaError);
    return (e as ProblemaError).aProblema();
  }
};

describe('mapper de Docente: asistencia', () => {
  it('totales, porcentaje, mínimo y condición tal como los informa el Módulo 2', () => {
    expect(aAsistencia(bd1)).toMatchObject({
      clasesDictadas: 8,
      presentes: 5,
      justificadas: 1,
      ausentes: 2,
      porcentaje: 75,
      porcentajeMinimo: 75,
      condicion: 'REGULAR',
    });
  });

  it('cada clase con su estado y el comentario, si viene', () => {
    const { clases } = aAsistencia(bd1);
    expect(clases).toHaveLength(8);
    expect(clases[0]).toEqual({ fecha: '2026-08-10', estado: 'PRESENTE', comentario: null });
    expect(clases[5]).toEqual({
      fecha: '2026-09-14',
      estado: 'JUSTIFICADO',
      comentario: 'Certificado médico',
    });
  });

  it('una clase sin registro del alumno queda con estado null', () => {
    const clases = [{ date: '2026-10-05' }];
    expect(aAsistencia({ ...bd1, classes: clases }).clases).toEqual([
      { fecha: '2026-10-05', estado: null, comentario: null },
    ]);
  });

  it('las clases quedan ordenadas por fecha aunque lleguen desordenadas', () => {
    const clases = [
      { date: '2026-08-24', status: 'PRESENTE' },
      { date: '2026-08-10', status: 'AUSENTE' },
    ];
    expect(aAsistencia({ ...bd1, classes: clases }).clases.map((c) => c.fecha)).toEqual([
      '2026-08-10',
      '2026-08-24',
    ]);
  });

  it('la condición LIBRE pasa tal cual: el portal no la calcula', () => {
    expect(aAsistencia(asistencias['1003'])).toMatchObject({
      porcentaje: 68.75,
      condicion: 'LIBRE',
    });
  });

  it.each([
    ['un porcentaje fuera de rango', { attendancePercentage: 875 }],
    ['una condición desconocida', { condition: 'CONDICIONAL' }],
    ['sin mínimo', { threshold: undefined }],
    ['una fecha con hora', { classes: [{ date: '2026-08-10T19:00:00Z', status: 'PRESENTE' }] }],
    ['un estado de clase desconocido', { classes: [{ date: '2026-08-10', status: 'TARDE' }] }],
    ['una cantidad como string', { present: '5' }],
  ])('%s es 502 de DOCENTE', (_caso, cambio) => {
    expect(error502(() => aAsistencia({ ...bd1, ...cambio }))).toMatchObject({
      status: 502,
      code: 'UPSTREAM_INVALID',
      modulo: 'DOCENTE',
    });
  });
});

describe('mapper de Docente: notas', () => {
  it('instancia desde la categoría, título, fecha, nota y resultado; el examId es el notaId', () => {
    const { notas: lista, promedio } = aNotasCurso(notas['1005']);
    expect(promedio).toBe(8);
    expect(lista[0]).toEqual({
      notaId: '101',
      instancia: 'PARCIAL',
      titulo: 'Parcial 1',
      fecha: '2026-09-21',
      nota: 7,
      resultado: 'APROBADO',
      docenteId: '7c1d9e2a-3b4f-4a5c-9d6e-8f7a0b1c2d3e',
    });
    expect(lista[1]).toMatchObject({ instancia: 'INTEGRADOR', titulo: 'TP1' });
  });

  it('un examen sin nota todavía queda con nota null y sin resultado', () => {
    const futuro = aNotasCurso(notas['1005']).notas[2];
    expect(futuro).toEqual({
      notaId: '103',
      instancia: 'PARCIAL',
      titulo: 'Parcial 2',
      fecha: '2026-11-16',
      nota: null,
      docenteId: null,
    });
  });

  it('resultado: ausente, aprobado o desaprobado según lo que informa el Módulo 2', () => {
    const [p1, recuperatorio, oral] = aNotasCurso(notasDesa1).notas;
    expect(p1).toMatchObject({ nota: 3.5, resultado: 'DESAPROBADO' });
    expect(recuperatorio).toMatchObject({ nota: 8, resultado: 'APROBADO' });
    expect(oral).toMatchObject({ nota: null, resultado: 'AUSENTE' });
  });

  it('los exámenes cancelados no se listan', () => {
    expect(aNotasCurso(notasDesa1).notas.map((n) => n.notaId)).toEqual(['201', '202', '204']);
  });

  it('una categoría desconocida o null deja la instancia en null: el catálogo puede crecer', () => {
    expect(aNotasCurso(notasDesa1).notas[2]).toMatchObject({
      instancia: null,
      titulo: 'Exposición oral',
    });
    const conTp3 = { ...notasDesa1, exams: [{ ...examen, category: 'COLOQUIO' }] };
    expect(aNotasCurso(conTp3).notas[0]!.instancia).toBeNull();
  });

  it('sin promedio informado, queda null', () => {
    const { average: _a, ...sinPromedio } = notasDesa1 as Record<string, unknown>;
    expect(aNotasCurso(sinPromedio).promedio).toBeNull();
  });

  it('sin exámenes, lista vacía', () => {
    expect(aNotasCurso({ ...notasDesa1, exams: [] }).notas).toEqual([]);
  });

  it.each([
    ['una nota como string', { grade: '7' }],
    ['sin examId', { examId: undefined }],
    ['sin nombre', { name: undefined }],
    ['una fecha con hora', { date: '2026-09-23T19:00:00Z' }],
  ])('%s es 502 de DOCENTE', (_caso, cambio) => {
    const datos = { ...notasDesa1, exams: [{ ...examen, ...cambio }] };
    expect(error502(() => aNotasCurso(datos))).toMatchObject({ status: 502, modulo: 'DOCENTE' });
  });
});

describe('mapper de Docente: notas finales', () => {
  it('la nota de cada curso con acta; sin nota (LIBRE), null', () => {
    const finales = aNotasFinales(resultados);
    expect(finales.get('1001')).toBe(8);
    expect(finales.get('1003')).toBeNull();
    expect(finales.has('1005')).toBe(false);
  });

  it('un courseId numérico pasa a string sin interpretarlo', () => {
    const finales = aNotasFinales([{ courseId: 42, grade: 6, result: 'APROBADO' }]);
    expect(finales.get('42')).toBe(6);
  });

  it('una nota como string es 502 de DOCENTE', () => {
    const datos = [{ courseId: 42, grade: '6', result: 'APROBADO' }];
    expect(error502(() => aNotasFinales(datos))).toMatchObject({ modulo: 'DOCENTE' });
  });
});
