import type { ListaSedes, Perfil } from '@uadenet/api-types';
import type { Alumno } from '../../auth/alumno.decorator';
import { idOpaco, parsearOrigen, respuestaInvalida } from '../comun';
import { SedesBackoffice, UsuarioBackoffice } from './backoffice.origen';

/**
 * Identidad de CORE (token) + datos personales de Backoffice → Perfil. El id sale siempre
 * del token. Los campos provisionales que no vengan se omiten.
 */
export function aPerfil(alumno: Alumno, datos: unknown): Perfil {
  const usuario = parsearOrigen('BACKOFFICE', UsuarioBackoffice, datos);
  const email = alumno.email ?? usuario.email;
  if (!email) throw respuestaInvalida('BACKOFFICE', 'El usuario no tiene mail');

  return {
    id: alumno.id,
    email,
    ...(usuario.nombre !== undefined && { nombre: usuario.nombre }),
    ...(usuario.apellido !== undefined && { apellido: usuario.apellido }),
    ...(usuario.legajo !== undefined && { legajo: String(usuario.legajo) }),
    ...(usuario.carrera !== undefined && { carrera: usuario.carrera }),
    ...(usuario.planId !== undefined && {
      planId: usuario.planId === null ? null : idOpaco(usuario.planId),
    }),
  };
}

/** Backoffice no conoce al alumno: el perfil queda solo con la identidad del token. */
export function perfilSoloIdentidad(alumno: Alumno): Perfil {
  if (!alumno.email) throw respuestaInvalida('BACKOFFICE', 'El usuario no existe en Backoffice');
  return { id: alumno.id, email: alumno.email };
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
