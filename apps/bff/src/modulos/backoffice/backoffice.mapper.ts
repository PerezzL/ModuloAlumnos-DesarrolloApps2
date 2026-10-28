import type { ListaSedes } from '@uadenet/api-types';
import type { Alumno } from '../../auth/alumno.decorator';
import { idOpaco, parsearOrigen, respuestaInvalida } from '../comun';
import type { FichaAlumno } from './backoffice.modelo';
import { SedesBackoffice, UsuarioBackoffice } from './backoffice.origen';

/**
 * Identidad de CORE (token) + datos personales de Backoffice → ficha. El id sale siempre
 * del token. Los campos que no vengan se omiten.
 *
 * Suponemos un solo plan por alumno: de `careers` se toma la primera. Si se manejan varias
 * carreras, hay que cambiar `planId` por una lista acá, en el filtro de cursos de la oferta
 * (InscripcionService y AcademicoAdapter.cursos) y en `Perfil` del openapi.yaml.
 */
export function aFicha(alumno: Alumno, datos: unknown): FichaAlumno {
  const usuario = parsearOrigen('BACKOFFICE', UsuarioBackoffice, datos);
  const email = alumno.email ?? usuario.email;
  if (!email) throw respuestaInvalida('BACKOFFICE', 'El usuario no tiene mail');
  const carrera = usuario.careers?.[0];
  return {
    perfil: {
      id: alumno.id,
      email,
      ...(usuario.firstName !== undefined && { nombre: usuario.firstName }),
      ...(usuario.lastName !== undefined && { apellido: usuario.lastName }),
      ...(usuario.fileNumber !== undefined && { legajo: String(usuario.fileNumber) }),
      // `careers` vacío o null: Backoffice informa que no tiene plan. Ausente: no lo informó
      ...(usuario.careers !== undefined && {
        planId: carrera ? idOpaco(carrera.planId) : null,
      }),
    },
    carreraId: carrera ? idOpaco(carrera.careerId) : null,
  };
}

/** Backoffice no conoce al alumno: la ficha queda solo con la identidad del token. */
export function fichaSoloIdentidad(alumno: Alumno): FichaAlumno {
  if (!alumno.email) throw respuestaInvalida('BACKOFFICE', 'El usuario no existe en Backoffice');
  return { perfil: { id: alumno.id, email: alumno.email }, carreraId: null };
}

/** Una página del catálogo de sedes → siteId → nombre, y el cursor de la siguiente. */
export function aSedes(datos: unknown) {
  const pagina = parsearOrigen('BACKOFFICE', SedesBackoffice, datos);
  return {
    nombres: new Map(pagina.items.map((s) => [s.siteId, s.name])),
    nextCursor: pagina.nextCursor ?? null,
  };
}

/** Catálogo siteId → nombre → ListaSedes, por nombre. El id es el `siteId`, sin tocar. */
export function aListaSedes(nombres: ReadonlyMap<string, string>): ListaSedes {
  return {
    items: [...nombres]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  };
}
