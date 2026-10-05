import { describe, expect, it } from 'vitest';
import { fixture } from '../../../test/fixtures';
import { ProblemaError } from '../../comun/problema';
import { aAsistencia, aNotaConDocente, aNotas } from './docente.mapper';

const asistencias = fixture<Record<string, Record<string, unknown>>>(
  'teacher/asistencia.provisional.json',
);
const bd1 = asistencias['curso-bd1-2026-2-a']!;
const notas = fixture<Record<string, Record<string, unknown>[]>>('teacher/notas.provisional.json');
const notasDesa1 = notas['curso-desa1-2026-2-a']!;

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
  it('totales, porcentaje, límite y clases por fecha', () => {
    const asistencia = aAsistencia(bd1);
    expect(asistencia).toMatchObject({
      clasesDictadas: 8,
      presentes: 5,
      ausentes: 3,
      porcentaje: 62.5,
      limiteInasistencias: 4,
      inasistenciasRestantes: 1,
    });
    expect(asistencia.clases).toHaveLength(8);
    expect(asistencia.clases![0]).toEqual({ fecha: '2026-08-10', presente: true });
    expect(asistencia.clases!.filter((c) => !c.presente)).toHaveLength(3);
  });

  it('sin límite informado, límite y faltas restantes quedan null: no se calculan', () => {
    const { limiteInasistencias: _l, inasistenciasRestantes: _r, ...sinLimite } = bd1;
    expect(aAsistencia(sinLimite)).toMatchObject({
      limiteInasistencias: null,
      inasistenciasRestantes: null,
    });
  });

  it('con límite pero sin faltas restantes, no se calculan a partir de las ausencias', () => {
    expect(aAsistencia({ ...bd1, inasistenciasRestantes: null })).toMatchObject({
      limiteInasistencias: 4,
      inasistenciasRestantes: null,
    });
  });

  it('las clases quedan ordenadas por fecha aunque lleguen desordenadas', () => {
    const clases = [
      { fecha: '2026-08-24', presente: true },
      { fecha: '2026-08-10', presente: false },
    ];
    expect(aAsistencia({ ...bd1, clases }).clases!.map((c) => c.fecha)).toEqual([
      '2026-08-10',
      '2026-08-24',
    ]);
  });

  it('sin clases dictadas ni listado, lista vacía', () => {
    const { clases: _c, ...sinClases } = bd1;
    const asistencia = aAsistencia({
      ...sinClases,
      clasesDictadas: 0,
      presentes: 0,
      ausentes: 0,
      porcentaje: 0,
    });
    expect(asistencia).toMatchObject({ clasesDictadas: 0, clases: [] });
  });

  it.each([
    ['un porcentaje fuera de rango', { porcentaje: 875 }],
    ['una fecha con hora', { clases: [{ fecha: '2026-08-10T19:00:00Z', presente: true }] }],
    ['una cantidad como string', { presentes: '5' }],
  ])('%s es 502 de DOCENTE', (_caso, cambio) => {
    expect(error502(() => aAsistencia({ ...bd1, ...cambio }))).toMatchObject({
      status: 502,
      code: 'UPSTREAM_INVALID',
      modulo: 'DOCENTE',
    });
  });
});

describe('mapper de Docente: notas', () => {
  it('instancia, título, fecha, nota y resultado; el examId es el notaId', () => {
    expect(aNotas(notas['curso-bd1-2026-2-a'])).toEqual([
      {
        notaId: 'exam-bd1-2026-2-p1',
        instancia: 'PARCIAL',
        titulo: '1er parcial',
        fecha: '2026-09-21',
        nota: 7,
        resultado: 'APROBADO',
      },
    ]);
  });

  it('un examen sin nota todavía queda con nota null y sin resultado', () => {
    const [, recuperatorio] = aNotas(notasDesa1);
    expect(recuperatorio).toEqual({
      notaId: 'exam-desa1-2026-2-r1',
      instancia: 'RECUPERATORIO',
      titulo: 'Recuperatorio 1er parcial',
      fecha: '2026-10-28',
      nota: null,
    });
  });

  it('docente y observaciones no van en el listado', () => {
    expect(aNotas(notasDesa1)[0]).not.toHaveProperty('observaciones');
    expect(aNotas(notasDesa1)[0]).not.toHaveProperty('docente');
  });

  it('un examId numérico pasa a string sin interpretarlo', () => {
    expect(aNotas([{ ...notasDesa1[0], examId: 42 }])[0]!.notaId).toBe('42');
  });

  it('sin notas, lista vacía', () => {
    expect(aNotas(notas['curso-ayed-2025-2-a'])).toEqual([]);
  });

  it.each([
    ['una instancia desconocida', { instancia: 'COLOQUIO' }],
    ['una nota como string', { nota: '7' }],
    ['sin examId', { examId: undefined }],
  ])('%s es 502 de DOCENTE', (_caso, cambio) => {
    expect(error502(() => aNotas([{ ...notasDesa1[0], ...cambio }]))).toMatchObject({
      status: 502,
      modulo: 'DOCENTE',
    });
  });
});

describe('mapper de Docente: detalle de una nota', () => {
  it('la nota con docente y observaciones', () => {
    expect(aNotaConDocente(notasDesa1[0])).toEqual({
      notaId: 'exam-desa1-2026-2-p1',
      instancia: 'PARCIAL',
      titulo: '1er parcial',
      fecha: '2026-09-23',
      nota: 4,
      resultado: 'DESAPROBADO',
      docente: 'Lic. Martín Sosa',
      observaciones: 'Revisar normalización.',
    });
  });

  it('sin docente ni observaciones, quedan null', () => {
    const { docente: _d, observaciones: _o, ...sinDatos } = notasDesa1[0]!;
    expect(aNotaConDocente(sinDatos)).toMatchObject({ docente: null, observaciones: null });
  });
});
