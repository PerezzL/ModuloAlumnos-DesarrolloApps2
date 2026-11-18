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
  estado: 'CURSANDO',
  ...cambios,
});

describe('inscripción del alumno en un curso', () => {
  it('encuentra la del curso con su comisión', () => {
    expect(inscripcionDelCurso(inscripciones, '1005')).toMatchObject({
      cursoId: '1005',
      comision: 'A - Noche',
      estado: 'CURSANDO',
    });
  });

  it('un curso en el que no está inscripto → undefined', () => {
    expect(inscripcionDelCurso(inscripciones, 'curso-de-otro')).toBeUndefined();
  });

  it('el id se compara tal cual: es opaco', () => {
    expect(inscripcionDelCurso(inscripciones, '01005')).toBeUndefined();
  });

  it('si hay más de una en el mismo curso (una baja y una nueva), toma la más reciente', () => {
    const resultado = inscripcionDelCurso(
      [
        inscripcion({ estado: 'BAJA', fecha: '2026-03-01' }),
        inscripcion({ estado: 'CURSANDO', fecha: '2026-03-10' }),
      ],
      'c',
    );
    expect(resultado?.estado).toBe('CURSANDO');
  });
});
