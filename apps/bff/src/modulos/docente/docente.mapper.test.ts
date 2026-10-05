import { describe, expect, it } from 'vitest';
import { fixture } from '../../../test/fixtures';
import { ProblemaError } from '../../comun/problema';
import { aAsistencia } from './docente.mapper';

const asistencias = fixture<Record<string, Record<string, unknown>>>(
  'teacher/asistencia.provisional.json',
);
const bd1 = asistencias['curso-bd1-2026-2-a']!;

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
