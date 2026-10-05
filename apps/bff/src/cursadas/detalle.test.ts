import { describe, expect, it } from 'vitest';
import { fixture } from '../../test/fixtures';
import type { InscripcionAlumno } from '../modulos/academico/academico.modelo';
import { aInscripciones } from '../modulos/academico/academico.mapper';
import { inscripcionDelCurso } from './detalle';

const inscripciones = aInscripciones(fixture('academic/inscripciones-alumno.provisional.json'));

const inscripcion = (cambios: Partial<InscripcionAlumno>): InscripcionAlumno => ({
  cursoId: 'c',
  asignatura: { id: 'a', nombre: 'a' },
  periodo: { id: 'p', nombre: 'p' },
  notaFinal: null,
  estado: 'CURSANDO',
  ...cambios,
});

describe('inscripción del alumno en un curso', () => {
  it('encuentra la del curso con su comisión', () => {
    expect(inscripcionDelCurso(inscripciones, 'curso-bd1-2026-2-a')).toMatchObject({
      cursoId: 'curso-bd1-2026-2-a',
      comision: 'A - Noche',
      estado: 'CURSANDO',
    });
  });

  it('un curso en el que no está inscripto → undefined', () => {
    expect(inscripcionDelCurso(inscripciones, 'curso-de-otro')).toBeUndefined();
  });

  it('el id se compara tal cual: es opaco', () => {
    expect(inscripcionDelCurso(inscripciones, 'CURSO-BD1-2026-2-A')).toBeUndefined();
  });

  it('si hay más de una en el mismo curso (una baja y una nueva), toma la más reciente', () => {
    const resultado = inscripcionDelCurso(
      [
        inscripcion({ estado: 'BAJA', fecha: '2026-03-01T00:00:00Z' }),
        inscripcion({ estado: 'CURSANDO', fecha: '2026-03-10T00:00:00Z' }),
      ],
      'c',
    );
    expect(resultado?.estado).toBe('CURSANDO');
  });
});
