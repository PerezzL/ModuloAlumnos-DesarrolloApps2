import { config } from '@/config';

/**
 * Traducción de `actionUrl` a destino. ÚNICO lugar del front que conoce el formato del
 * `actionUrl` de cada módulo (pendiente con los módulos 2 y 3: docs/integraciones.md).
 *
 * - `TEACHER_EXAM_RESULT_PUBLISHED`: `/student/courses/{cursoId}/exams/{notaId}` (provisorio
 *   del Módulo 2) o `/cursadas/{cursoId}/notas/{notaId}` (la ruta que les propusimos) →
 *   pantalla propia del detalle de la nota. Cuando confirmen, queda una sola.
 * - `LIBRARY_PENALTY_APPLIED`: `/prestamos/{loanId}` (detalle del préstamo, confirmado por el
 *   Módulo 3) → portal de Biblioteca.
 * - `EVENT_REMINDER`: `/events/{eventoId}` → portal de Eventos.
 *
 * Solo se navega a rutas propias o a los portales configurados; un `actionUrl` vacío, con
 * otro formato o hacia otro origen devuelve null (no se navega).
 */

export type Portal = 'Biblioteca' | 'Eventos';

export type Destino =
  { tipo: 'interno'; ruta: string } | { tipo: 'externo'; url: string; portal: Portal };

/** Segmento de id seguro: sin `/`, `.`, `%` ni nada que cambie la ruta */
const ID = '([A-Za-z0-9_-]+)';
const EXAMEN = [
  new RegExp(`^/student/courses/${ID}/exams/${ID}/?$`),
  new RegExp(`^/cursadas/${ID}/notas/${ID}/?$`),
];
const PRESTAMO = new RegExp(`^/prestamos/${ID}/?$`);
const EVENTO = new RegExp(`^/events/${ID}/?$`);

/**
 * `actionUrl` relativa al portal (lo normal en CORE) o absoluta dentro del portal configurado →
 * ruta dentro de ese portal. El portal puede tener ruta base (`https://asignia.app/uade-net`):
 * una URL absoluta tiene que estar debajo de esa ruta y se le quita. Null si apunta a otro lado.
 */
function rutaEnPortal(actionUrl: string, base: string | undefined): string | null {
  if (!base) return null;
  let portal: URL;
  try {
    portal = new URL(base);
  } catch {
    return null;
  }
  if (actionUrl.startsWith('/') && !actionUrl.startsWith('//')) return actionUrl;
  let url: URL;
  try {
    url = new URL(actionUrl);
  } catch {
    return null;
  }
  if (url.origin !== portal.origin) return null;
  const prefijo = portal.pathname.replace(/\/$/, '');
  if (!prefijo) return url.pathname;
  return url.pathname.startsWith(`${prefijo}/`) ? url.pathname.slice(prefijo.length) : null;
}

function externo(base: string, ruta: string, portal: Portal): Destino {
  return { tipo: 'externo', url: `${base.replace(/\/$/, '')}${ruta}`, portal };
}

export function destinoDe(
  tipo: string,
  actionUrl: string | null | undefined,
  portales = config.portales,
): Destino | null {
  if (!actionUrl) return null;

  switch (tipo) {
    case 'TEACHER_EXAM_RESULT_PUBLISHED': {
      const [, cursoId, notaId] = EXAMEN.map((r) => r.exec(actionUrl)).find(Boolean) ?? [];
      return cursoId && notaId
        ? { tipo: 'interno', ruta: `/cursadas/${cursoId}/notas/${notaId}` }
        : null;
    }
    case 'LIBRARY_PENALTY_APPLIED': {
      const ruta = rutaEnPortal(actionUrl, portales.biblioteca);
      return ruta && PRESTAMO.test(ruta) ? externo(portales.biblioteca!, ruta, 'Biblioteca') : null;
    }
    case 'EVENT_REMINDER': {
      const ruta = rutaEnPortal(actionUrl, portales.eventos);
      return ruta && EVENTO.test(ruta) ? externo(portales.eventos!, ruta, 'Eventos') : null;
    }
    default:
      return null;
  }
}
