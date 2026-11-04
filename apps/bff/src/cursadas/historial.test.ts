import { describe, expect, it } from 'vitest';
import { fixture } from '../../test/fixtures';
import type { InscripcionAlumno } from '../modulos/academico/academico.modelo';
import { aInscripciones } from '../modulos/academico/academico.mapper';
import { aNotasFinales } from '../modulos/docente/docente.mapper';
import { aHistorial } from './historial';

const inscripciones = aInscripciones(fixture('academic/inscripciones-alumno.provisional.json'));
const notasFinales = aNotasFinales(
  fixture<Record<string, unknown>>('teacher/results.json')['ba310c57-a684-4dbf-a4a4-905fcfbefa08'],
);

const inscripcion = (cursoId: string, cambios: Partial<InscripcionAlumno> = {}) => ({
  cursoId,
  asignatura: { id: cursoId, nombre: cursoId },
  periodo: { id: 'p', nombre: 'p' },
  estado: 'APROBADO' as const,
  ...cambios,
});

describe('historial académico', () => {
  const historial = aHistorial(inscripciones, notasFinales);

  it('de la más reciente a la más antigua', () => {
    expect(historial.map((c) => c.cursoId)).toEqual([
      'curso-desa1-2026-2-a',
      'curso-bd1-2026-2-a',
      'curso-prog2-2026-1-a',
      'curso-ayed-2025-2-a',
      'curso-discreta-2025-2-a',
      'curso-prog1-2025-2-a',
    ]);
  });

  it('cada cursada con materia, período, nota y situación', () => {
    expect(historial.at(-1)).toEqual({
      cursoId: 'curso-prog1-2025-2-a',
      asignatura: { id: 'asig-prog1', codigo: '3.4.069', nombre: 'Programación I' },
      periodo: { id: '2025-2', nombre: '2° cuatrimestre 2025' },
      notaFinal: 8,
      estado: 'APROBADO',
      enCurso: false,
    });
  });

  it('sin nota final queda null, no cero', () => {
    expect(historial.find((c) => c.estado === 'LIBRE')?.notaFinal).toBeNull();
    expect(historial.find((c) => c.cursoId === 'curso-bd1-2026-2-a')?.notaFinal).toBeNull();
  });

  it('sin notas finales (el Módulo 2 no respondió), todas en null', () => {
    expect(aHistorial(inscripciones, null).every((c) => c.notaFinal === null)).toBe(true);
  });

  it.each([
    ['INSCRIPTO', true],
    ['CURSANDO', true],
    ['BAJA', false],
    ['REGULAR', false],
    ['LIBRE', false],
    ['APROBADO', false],
    ['DESAPROBADO', false],
  ] as const)('%s → enCurso %s', (estado, enCurso) => {
    expect(aHistorial([inscripcion('c', { estado })], null)[0]!.enCurso).toBe(enCurso);
  });

  it('las que no tienen fecha van al final, en el orden en que llegaron', () => {
    const resultado = aHistorial(
      [
        inscripcion('sin-fecha-1'),
        inscripcion('vieja', { fecha: '2025-01-01T00:00:00Z' }),
        inscripcion('sin-fecha-2'),
        inscripcion('nueva', { fecha: '2026-01-01T00:00:00Z' }),
      ],
      null,
    );
    expect(resultado.map((c) => c.cursoId)).toEqual([
      'nueva',
      'vieja',
      'sin-fecha-1',
      'sin-fecha-2',
    ]);
  });

  it('sin inscripciones, historial vacío', () => {
    expect(aHistorial([], new Map())).toEqual([]);
  });
});
