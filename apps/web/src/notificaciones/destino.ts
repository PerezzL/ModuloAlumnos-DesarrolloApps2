import { config } from '@/config';

/**
 * Traducción de `actionUrl` a destino. ÚNICO lugar del front que conoce el formato del
 * `actionUrl` de cada módulo (pendiente con los módulos 2 y 3: docs/integraciones.md).
 *
 * - `EXAM_RESULT_PUBLISHED`: `/teacher/courses/{cursoId}/exams/{notaId}` → pantalla propia
 *   del detalle de la nota.
 * - `LIBRARY_PENALTY_APPLIED`: `/library/{loanId}/penalty` → portal de Biblioteca.
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
const EXAMEN = new RegExp(`^/teacher/courses/${ID}/exams/${ID}/?$`);
const SANCION = new RegExp(`^/library/${ID}/penalty/?$`);
const EVENTO = new RegExp(`^/events/${ID}/?$`);

/**
 * `actionUrl` relativa (lo normal en CORE) o absoluta hacia el portal configurado → ruta
 * dentro de ese portal. Null si apunta a otro origen.
 */
function rutaEnPortal(actionUrl: string, base: string | undefined): string | null {
  if (!base) return null;
  let origen: URL;
  try {
    origen = new URL(base);
  } catch {
    return null;
  }
  if (actionUrl.startsWith('/') && !actionUrl.startsWith('//')) return actionUrl;
  try {
    const url = new URL(actionUrl);
    return url.origin === origen.origin ? url.pathname : null;
  } catch {
    return null;
  }
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
    case 'EXAM_RESULT_PUBLISHED': {
      const [, cursoId, notaId] = EXAMEN.exec(actionUrl) ?? [];
      return cursoId && notaId
        ? { tipo: 'interno', ruta: `/cursadas/${cursoId}/notas/${notaId}` }
        : null;
    }
    case 'LIBRARY_PENALTY_APPLIED': {
      const ruta = rutaEnPortal(actionUrl, portales.biblioteca);
      return ruta && SANCION.test(ruta) ? externo(portales.biblioteca!, ruta, 'Biblioteca') : null;
    }
    case 'EVENT_REMINDER': {
      const ruta = rutaEnPortal(actionUrl, portales.eventos);
      return ruta && EVENTO.test(ruta) ? externo(portales.eventos!, ruta, 'Eventos') : null;
    }
    default:
      return null;
  }
}
