import type { ListaSedes } from '@uadenet/api-types';
import type { Alumno } from '../../auth/alumno.decorator';
import { idOpaco, parsearOrigen, respuestaInvalida } from '../comun';
import type { FichaAlumno } from './backoffice.modelo';
import { SedesBackoffice, UsuarioBackoffice } from './backoffice.origen';

/**
 * Identidad de CORE (token) + datos personales de Backoffice → ficha. El id sale siempre
 * del token. Los campos que no vengan se omiten.
 *
 * Carrera: la primera de `careerIds` del token de CORE. Si el token no trae ninguna, la de
 * Backoffice: la primera de `careers` (comprometido, sin publicar) o, si no viene, el
 * `careerId` suelto (confirmado). Plan: el primero de `planIds` del token; si no trae ninguno,
 * el que Backoffice da para la carrera elegida, o null si no la tiene (la oferta usa entonces
 * el plan activo de la carrera en el Módulo 9).
 *
 * Suponemos un solo plan por alumno. Si se manejan varias carreras, hay que cambiar `planId`
 * por una lista acá, en el plan de la oferta (InscripcionService) y en `Perfil` del
 * openapi.yaml.
 */
export function aFicha(alumno: Alumno, datos: unknown): FichaAlumno {
  const usuario = parsearOrigen('BACKOFFICE', UsuarioBackoffice, datos);
  const email = alumno.email ?? usuario.email;
  if (!email) throw respuestaInvalida('BACKOFFICE', 'El usuario no tiene mail');
  const delToken = carreraDelToken(alumno);
  const planToken = planDelToken(alumno);
  const carrera =
    delToken === null
      ? usuario.careers?.[0]
      : usuario.careers?.find((c) => idOpaco(c.careerId) === delToken);
  return {
    perfil: {
      id: alumno.id,
      email,
      ...(usuario.firstName !== undefined && { nombre: usuario.firstName }),
      ...(usuario.lastName !== undefined && { apellido: usuario.lastName }),
      ...(usuario.fileNumber !== undefined && { legajo: String(usuario.fileNumber) }),
      // `careers` vacío o null: Backoffice informa que no tiene plan. Ausente: no lo informó
      ...(planToken !== null
        ? { planId: planToken }
        : usuario.careers !== undefined && {
            planId: carrera ? idOpaco(carrera.planId) : null,
          }),
    },
    carreraId:
      delToken ??
      (carrera ? idOpaco(carrera.careerId) : null) ??
      (usuario.careerId != null ? idOpaco(usuario.careerId) : null),
  };
}

/** Primera carrera del token, o null si no trae ninguna. */
const carreraDelToken = (alumno: Alumno) => alumno.carreraIds?.[0] ?? null;

/** Primer plan del token, o null si no trae ninguno. */
const planDelToken = (alumno: Alumno) => alumno.planIds?.[0] ?? null;

/** Nombre y apellido de un usuario de Backoffice; null si no tiene ninguno de los dos. */
export function aNombreCompleto(datos: unknown): string | null {
  const usuario = parsearOrigen('BACKOFFICE', UsuarioBackoffice, datos);
  const nombre = [usuario.firstName, usuario.lastName].filter(Boolean).join(' ');
  return nombre || null;
}

/** Backoffice no conoce al alumno: la ficha queda solo con lo que trae el token. */
export function fichaSoloIdentidad(alumno: Alumno): FichaAlumno {
  if (!alumno.email) throw respuestaInvalida('BACKOFFICE', 'El usuario no existe en Backoffice');
  const planId = planDelToken(alumno);
  return {
    perfil: { id: alumno.id, email: alumno.email, ...(planId !== null && { planId }) },
    carreraId: carreraDelToken(alumno),
  };
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
