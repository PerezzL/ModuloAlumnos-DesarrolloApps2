import { describe, expect, it } from 'vitest';
import { fixture } from '../../../test/fixtures';
import { ProblemaError } from '../../comun/problema';
import { aPerfil } from './backoffice.mapper';

const usuarios = fixture<Record<string, unknown>>('backoffice/users.provisional.json');
const conPlan = usuarios['ba310c57-a684-4dbf-a4a4-905fcfbefa08'];
const sinPlan = usuarios['6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f'];
const alumno = { id: 'ba310c57-a684-4dbf-a4a4-905fcfbefa08', email: 'v.moreno@uade.edu.ar' };

describe('mapper de Backoffice → Perfil', () => {
  it('combina la identidad del token con los datos personales', () => {
    expect(aPerfil(alumno, conPlan)).toEqual({
      id: alumno.id,
      email: 'v.moreno@uade.edu.ar',
      nombre: 'Valentina',
      apellido: 'Moreno',
      legajo: '1123456',
      carrera: 'Ingeniería en Informática',
      planId: 'plan-2020',
    });
  });

  it('el id y el mail salen del token, no de Backoffice', () => {
    const perfil = aPerfil({ id: 'otro', email: 'otro@uade.edu.ar' }, conPlan);
    expect(perfil).toMatchObject({ id: 'otro', email: 'otro@uade.edu.ar' });
  });

  it('planId null se conserva como null', () => {
    expect(aPerfil(alumno, sinPlan).planId).toBeNull();
  });

  it('los campos que Backoffice no manda quedan afuera, sin romper', () => {
    expect(aPerfil(alumno, { id: alumno.id })).toEqual({ id: alumno.id, email: alumno.email });
  });

  it('un legajo numérico se convierte a string', () => {
    expect(aPerfil(alumno, { legajo: 1123456 }).legajo).toBe('1123456');
  });

  it('sin mail en el token usa el de Backoffice', () => {
    expect(aPerfil({ id: alumno.id }, conPlan).email).toBe('v.moreno@uade.edu.ar');
  });

  it('una respuesta que no es un objeto es 502 de Backoffice', () => {
    const error = (() => {
      try {
        aPerfil(alumno, [1, 2]);
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(ProblemaError);
    expect((error as ProblemaError).aProblema()).toMatchObject({
      status: 502,
      code: 'UPSTREAM_INVALID',
      modulo: 'BACKOFFICE',
    });
  });
});
