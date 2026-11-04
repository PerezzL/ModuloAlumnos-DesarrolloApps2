import { describe, expect, it } from 'vitest';
import { fixture } from '../../../test/fixtures';
import { ProblemaError } from '../../comun/problema';
import { aFicha, aListaSedes, aNombreCompleto, aSedes } from './backoffice.mapper';

const usuarios = fixture<Record<string, Record<string, unknown>>>(
  'backoffice/users.provisional.json',
);
const conPlan = usuarios['ba310c57-a684-4dbf-a4a4-905fcfbefa08']!;
const sinCarreras = usuarios['6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f']!;
const alumno = { id: 'ba310c57-a684-4dbf-a4a4-905fcfbefa08', email: 'v.moreno@uade.edu.ar' };

describe('mapper de Backoffice → ficha del alumno', () => {
  it('combina la identidad del token con los datos personales y la carrera', () => {
    expect(aFicha(alumno, conPlan)).toEqual({
      perfil: {
        id: alumno.id,
        email: 'v.moreno@uade.edu.ar',
        nombre: 'Valentina',
        apellido: 'Moreno',
        legajo: '1123456',
        planId: '12',
      },
      carreraId: '3',
    });
  });

  it('el id y el mail salen del token, no de Backoffice', () => {
    const { perfil } = aFicha({ id: 'otro', email: 'otro@uade.edu.ar' }, conPlan);
    expect(perfil).toMatchObject({ id: 'otro', email: 'otro@uade.edu.ar' });
  });

  it('sin carreras, planId es null y no hay carrera', () => {
    expect(aFicha(alumno, sinCarreras)).toMatchObject({
      perfil: { planId: null },
      carreraId: null,
    });
  });

  it('careers null es lo mismo que sin carreras', () => {
    expect(aFicha(alumno, { ...conPlan, careers: null })).toMatchObject({
      perfil: { planId: null },
      carreraId: null,
    });
  });

  it('con varias carreras se toma la primera', () => {
    const dos = {
      ...conPlan,
      careers: [
        { careerId: '5', planId: '20' },
        { careerId: '3', planId: '12' },
      ],
    };
    expect(aFicha(alumno, dos)).toMatchObject({ perfil: { planId: '20' }, carreraId: '5' });
  });

  it('ids numéricos se convierten a string', () => {
    const numericos = { ...conPlan, fileNumber: 1123456, careers: [{ careerId: 3, planId: 12 }] };
    expect(aFicha(alumno, numericos)).toMatchObject({
      perfil: { legajo: '1123456', planId: '12' },
      carreraId: '3',
    });
  });

  it('sin careers, planId se omite: Backoffice no lo informó', () => {
    const { careers: _, ...sinCampo } = conPlan;
    const ficha = aFicha(alumno, sinCampo);
    expect(ficha.perfil).not.toHaveProperty('planId');
    expect(ficha.carreraId).toBeNull();
  });

  it('los campos que Backoffice no manda quedan afuera, sin romper', () => {
    expect(aFicha(alumno, { userId: alumno.id })).toEqual({
      perfil: { id: alumno.id, email: alumno.email },
      carreraId: null,
    });
  });

  it('sin mail en el token usa el de Backoffice', () => {
    expect(aFicha({ id: alumno.id }, conPlan).perfil.email).toBe('v.moreno@uade.edu.ar');
  });

  it('una respuesta que no es un objeto es 502 de Backoffice', () => {
    const error = (() => {
      try {
        aFicha(alumno, [1, 2]);
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

const sedes = fixture('backoffice/sites.json');

describe('mapper de Backoffice → sedes', () => {
  it('arma el mapa siteId → nombre, también con las sedes inactivas', () => {
    const { nombres, nextCursor } = aSedes(sedes);
    expect(nombres).toEqual(
      new Map([
        ['3e9b0a12-55cc-4d77-9a01-6b2f8c4e1d90', 'Sede Monserrat'],
        ['7b1d3f5a-9c2e-4a6b-8d0f-2e4a6c8b0d12', 'Sede Recoleta'],
        ['a4c6e8f0-2b4d-4f6a-9c1e-5d7f9b1a3c24', 'Sede Costa Argentina'],
      ]),
    );
    expect(nextCursor).toBeNull();
  });

  it('devuelve el cursor de la página siguiente', () => {
    expect(aSedes({ items: [], nextCursor: 'abc' }).nextCursor).toBe('abc');
  });

  it('una respuesta sin `items` es 502 de BACKOFFICE', () => {
    try {
      aSedes([]);
      expect.unreachable();
    } catch (e) {
      expect((e as ProblemaError).aProblema()).toMatchObject({ status: 502, modulo: 'BACKOFFICE' });
    }
  });
});

describe('catálogo de sedes → ListaSedes', () => {
  it('cada sede con su siteId como id, ordenadas por nombre', () => {
    const nombres = new Map([
      ['s-2', 'Sede Recoleta'],
      ['s-1', 'Sede Monserrat'],
      ['s-3', 'Sede Costa Argentina'],
    ]);
    expect(aListaSedes(nombres)).toEqual({
      items: [
        { id: 's-3', nombre: 'Sede Costa Argentina' },
        { id: 's-1', nombre: 'Sede Monserrat' },
        { id: 's-2', nombre: 'Sede Recoleta' },
      ],
    });
  });
});

describe('mapper de Backoffice → nombre de un usuario', () => {
  const docente = usuarios['7c1d9e2a-3b4f-4a5c-9d6e-8f7a0b1c2d3e']!;

  it('nombre y apellido', () => {
    expect(aNombreCompleto(docente)).toBe('Laura Gómez');
  });

  it('con uno solo de los dos, ese; sin ninguno, null', () => {
    expect(aNombreCompleto({ ...docente, firstName: undefined })).toBe('Gómez');
    expect(aNombreCompleto({ ...docente, firstName: undefined, lastName: undefined })).toBeNull();
  });
});
