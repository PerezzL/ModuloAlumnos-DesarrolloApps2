import { errorDeRespuesta, ErrorRed } from '@/api/errores';
import { crearFetchConSesion } from '@/api/fetchConSesion';
import { config } from '@/config';

const fetchConSesion = crearFetchConSesion();

export interface RespuestaCore<T> {
  status: number;
  datos: T;
}

/**
 * Llamada a CORE por el Gateway con el token del alumno (y refresh ante un 401).
 * Lanza ErrorRed si no hubo respuesta y ErrorApi con el problem+json si no fue 2xx.
 */
export async function pedirCore<T>(
  ruta: string,
  init: RequestInit = {},
): Promise<RespuestaCore<T>> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');

  let res: Response;
  try {
    res = await fetchConSesion(new Request(`${config.gatewayUrl}${ruta}`, { ...init, headers }));
  } catch (error) {
    throw new ErrorRed(error);
  }
  const texto = await res.text();
  let cuerpo: unknown = undefined;
  try {
    cuerpo = texto ? (JSON.parse(texto) as unknown) : undefined;
  } catch {
    cuerpo = texto;
  }
  if (!res.ok) throw errorDeRespuesta(res.status, cuerpo, res.headers.get('X-Correlation-Id'));
  return { status: res.status, datos: cuerpo as T };
}
