import { sesionActual, type Sesion } from '@/sesion/sesion';

/**
 * fetch con el access token. Ante un 401 refresca (serializado) y repite el pedido una sola
 * vez. Si el refresh falla, la sesión pasa a anónima y la ruta protegida lleva al login.
 */
export function crearFetchConSesion(obtenerSesion: () => Sesion = sesionActual) {
  return async function fetchConSesion(pedido: Request): Promise<Response> {
    const sesion = obtenerSesion();
    const copia = pedido.clone();
    const res = await fetch(conToken(pedido, sesion.token()));
    if (res.status !== 401) return res;

    const nuevo = await sesion.refrescar();
    if (!nuevo) return res;
    return fetch(conToken(copia, nuevo));
  };
}

function conToken(pedido: Request, token: string | null) {
  const headers = new Headers(pedido.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return new Request(pedido, { headers });
}
