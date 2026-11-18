import { describe, expect, it } from 'vitest';
import { ErrorApi, ErrorRed } from '@/api/errores';
import { describirRechazo } from './rechazos';

const rechazo = (code: string, extra: object = {}) =>
  new ErrorApi({ title: 'Inscripción rechazada', status: 409, code, ...extra });

describe('rechazos de la inscripción', () => {
  it.each([
    ['YA_INSCRIPTO', 'Ya estás inscripto'],
    ['SIN_CUPO', 'La comisión se quedó sin cupo'],
    ['CORRELATIVIDAD_FALTANTE', 'Te faltan correlativas'],
    ['SIN_REGULARIDAD', 'No cumplís la condición de regularidad'],
    ['FUERA_DE_FECHA', 'La inscripción está cerrada'],
    ['INSCRIPCION_RECHAZADA', 'No pudimos inscribirte'],
    ['OTRO_CODIGO_NUEVO', 'No pudimos inscribirte'],
  ])('%s → "%s"', (code, titulo) => {
    expect(describirRechazo(rechazo(code))?.titulo).toBe(titulo);
  });

  it('con CORRELATIVIDAD_FALTANTE trae las correlativas', () => {
    const faltantes = [{ asignaturaId: 'a', nombre: 'Programación II', tipo: 'REGULAR' }];
    expect(
      describirRechazo(rechazo('CORRELATIVIDAD_FALTANTE', { correlativasFaltantes: faltantes }))
        ?.correlativasFaltantes,
    ).toEqual(faltantes);
  });

  it('un rechazo sin motivo reconocido muestra el detalle de Gestión Académica', () => {
    const detail = 'La comisión no tiene cupo disponible';
    expect(describirRechazo(rechazo('INSCRIPCION_RECHAZADA', { detail }))).toMatchObject({
      titulo: 'No pudimos inscribirte',
      mensaje: detail,
    });
    expect(describirRechazo(rechazo('INSCRIPCION_RECHAZADA'))?.mensaje).toMatch(
      /Gestión Académica rechazó la inscripción/,
    );
  });

  it('lo que no es un 409 no es un rechazo', () => {
    expect(describirRechazo(new ErrorRed())).toBeNull();
    expect(describirRechazo(new ErrorApi({ title: 'x', status: 503, code: 'X' }))).toBeNull();
  });
});
