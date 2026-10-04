import { Router, type Request, type Response } from 'express';
import type { ConfigCore } from './config.js';
import { enviarProblema } from './problema.js';
import type { Tokens } from './tokens.js';
import { buscarPorEmail, buscarPorId, type UsuarioPrueba } from './usuarios.js';

export const COOKIE_REFRESH = 'refresh_token';
const MAX_INTENTOS = 5;
const VENTANA_INTENTOS_MS = 60_000;

const datosUsuario = (u: UsuarioPrueba) => ({
  id: u.id,
  email: u.email,
  roles: u.roles,
  permissions: u.permissions,
  status: u.status,
});

export function bearer(req: Request): string | undefined {
  const header = req.header('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

/** POST /login, /refresh, /logout y GET /me, como en la sección 3 de CORE_INTEGRACION.md. */
export function routerAuth(config: ConfigCore, tokens: Tokens) {
  const router = Router();
  const fallidos = new Map<string, number[]>();

  const setearCookie = (res: Response, refresh: string) =>
    res.cookie(COOKIE_REFRESH, refresh, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 3600 * 1000,
    });

  const limpiarCookie = (res: Response) =>
    res.clearCookie(COOKIE_REFRESH, { path: '/api/v1/auth' });

  router.post('/login', async (req, res) => {
    const { email, password } = (req.body ?? {}) as { email?: unknown; password?: unknown };
    if (typeof email !== 'string' || typeof password !== 'string') {
      return enviarProblema(res, 400, 'VALIDATION_ERROR', 'Email y contraseña son obligatorios');
    }

    const ahora = Date.now();
    const recientes = (fallidos.get(email) ?? []).filter((t) => ahora - t < VENTANA_INTENTOS_MS);
    if (recientes.length >= MAX_INTENTOS) {
      res.setHeader('Retry-After', '60');
      return enviarProblema(res, 429, 'RATE_LIMITED', 'Demasiados intentos');
    }

    const usuario = buscarPorEmail(email);
    if (!usuario || usuario.password !== password) {
      fallidos.set(email, [...recientes, ahora]);
      return enviarProblema(res, 401, 'AUTH_INVALID_CREDENTIALS', 'Credenciales inválidas');
    }
    if (usuario.status === 'SUSPENDED') {
      return enviarProblema(res, 403, 'AUTH_IDENTITY_SUSPENDED', 'Cuenta suspendida');
    }

    fallidos.delete(email);
    const { sid, refresh } = tokens.abrirSesion(usuario.id);
    setearCookie(res, refresh);
    res.json({
      accessToken: await tokens.emitirAccess(usuario, sid),
      expiresIn: config.accessTtlS,
      user: datosUsuario(usuario),
    });
  });

  router.post('/refresh', async (req, res) => {
    const actual = (req.cookies as Record<string, string | undefined>)[COOKIE_REFRESH];
    const rotado = actual ? tokens.rotar(actual) : undefined;
    const usuario = rotado && buscarPorId(rotado.sesion.userId);
    if (!rotado || !usuario || usuario.status !== 'ACTIVE') {
      limpiarCookie(res);
      return enviarProblema(res, 401, 'AUTH_REFRESH_INVALID', 'Sesión vencida');
    }
    setearCookie(res, rotado.refresh);
    res.json({
      accessToken: await tokens.emitirAccess(usuario, rotado.sesion.sid),
      expiresIn: config.accessTtlS,
    });
  });

  router.post('/logout', async (req, res) => {
    const token = bearer(req);
    const claims = token ? await tokens.verificarAccess(token) : undefined;
    const refresh = (req.cookies as Record<string, string | undefined>)[COOKIE_REFRESH];
    const sid = claims?.sid ?? (refresh ? tokens.sesionDeRefresh(refresh)?.sid : undefined);
    if (sid) tokens.cerrarSesion(sid);
    limpiarCookie(res);
    res.status(204).end();
  });

  router.get('/me', async (req, res) => {
    const token = bearer(req);
    const claims = token ? await tokens.verificarAccess(token) : undefined;
    const usuario = claims && buscarPorId(claims.sub);
    if (!usuario) return enviarProblema(res, 401, 'AUTH_TOKEN_INVALID', 'No autenticado');
    res.json(datosUsuario(usuario));
  });

  return router;
}
