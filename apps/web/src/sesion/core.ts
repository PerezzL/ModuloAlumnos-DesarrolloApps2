import { config } from '@/config';

/**
 * Llamadas de autenticación contra CORE: por el Gateway, o por el reenvío del propio hosting si
 * `VITE_AUTH_PROXY=true` (ver `baseAuth` en config.ts). No pasan por el BFF.
 * Contrato: docs/core/CORE_INTEGRACION.md, sección 3.
 */

export interface UsuarioCore {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  status: string;
}

export type MotivoErrorLogin =
  | 'CREDENCIALES_INVALIDAS'
  | 'CUENTA_SUSPENDIDA'
  | 'DEMASIADOS_INTENTOS'
  | 'SIN_CONEXION'
  | 'DESCONOCIDO';

export class ErrorLogin extends Error {
  constructor(readonly motivo: MotivoErrorLogin) {
    super(motivo);
  }
}

const url = (ruta: string) => `${config.authUrl}/api/v1/auth${ruta}`;

export async function login(email: string, password: string) {
  let res: Response;
  try {
    res = await fetch(url('/login'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new ErrorLogin('SIN_CONEXION');
  }
  if (res.ok) {
    return (await res.json()) as { accessToken: string; expiresIn: number; user: UsuarioCore };
  }
  const motivos: Record<number, MotivoErrorLogin> = {
    401: 'CREDENCIALES_INVALIDAS',
    403: 'CUENTA_SUSPENDIDA',
    429: 'DEMASIADOS_INTENTOS',
  };
  throw new ErrorLogin(motivos[res.status] ?? 'DESCONOCIDO');
}

/** Pide un access token nuevo con la cookie de refresh. Null si la sesión ya no es válida. */
export async function refresh(): Promise<string | null> {
  const res = await fetch(url('/refresh'), { method: 'POST', credentials: 'include' });
  if (!res.ok) return null;
  return ((await res.json()) as { accessToken: string }).accessToken;
}

export async function me(accessToken: string): Promise<UsuarioCore | null> {
  const res = await fetch(url('/me'), { headers: { Authorization: `Bearer ${accessToken}` } });
  return res.ok ? ((await res.json()) as UsuarioCore) : null;
}

export async function logout(accessToken: string | null) {
  await fetch(url('/logout'), {
    method: 'POST',
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
}
