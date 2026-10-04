import * as core from './core';
import type { UsuarioCore } from './core';

export type EstadoSesion =
  { tipo: 'cargando' } | { tipo: 'anonimo' } | { tipo: 'autenticado'; usuario: UsuarioCore };

type Oyente = (estado: EstadoSesion) => void;

/**
 * Sesión del alumno. El access token vive solo en memoria (nunca en localStorage ni
 * sessionStorage); el refresh token es una cookie HttpOnly que el front no ve.
 *
 * Los refresh se serializan: CORE rota el refresh token en cada uso, así que dos refresh en
 * paralelo invalidan la sesión. Todos los que necesitan refrescar a la vez esperan la misma
 * promesa.
 */
export class Sesion {
  private estado: EstadoSesion = { tipo: 'cargando' };
  private accessToken: string | null = null;
  private refreshEnCurso: Promise<string | null> | null = null;
  private readonly oyentes = new Set<Oyente>();

  obtenerEstado = () => this.estado;

  suscribir = (oyente: Oyente) => {
    this.oyentes.add(oyente);
    return () => {
      this.oyentes.delete(oyente);
    };
  };

  token() {
    return this.accessToken;
  }

  /** Al abrir o recargar la app: intenta recuperar la sesión con la cookie de refresh. */
  async iniciar() {
    const token = await this.refrescar();
    if (!token) return;
    const usuario = await core.me(token).catch(() => null);
    if (usuario) this.cambiar({ tipo: 'autenticado', usuario });
    else this.terminarLocal();
  }

  async iniciarSesion(email: string, password: string) {
    const { accessToken, user } = await core.login(email, password);
    this.accessToken = accessToken;
    this.cambiar({ tipo: 'autenticado', usuario: user });
  }

  /** Devuelve el token nuevo, o null si la sesión terminó. Serializado. */
  refrescar(): Promise<string | null> {
    this.refreshEnCurso ??= core
      .refresh()
      .catch(() => null)
      .then((token) => {
        if (token) this.accessToken = token;
        else this.terminarLocal();
        return token;
      })
      .finally(() => {
        this.refreshEnCurso = null;
      });
    return this.refreshEnCurso;
  }

  async cerrarSesion() {
    const token = this.accessToken;
    this.terminarLocal();
    await core.logout(token).catch(() => undefined);
  }

  private terminarLocal() {
    this.accessToken = null;
    this.cambiar({ tipo: 'anonimo' });
  }

  private cambiar(estado: EstadoSesion) {
    this.estado = estado;
    for (const oyente of this.oyentes) oyente(estado);
  }
}

let actual = new Sesion();

/** Sesión que usan el cliente del BFF y las llamadas a CORE. */
export const sesionActual = () => actual;

/** La fija SesionProvider; en los tests permite empezar cada caso con una sesión limpia. */
export function establecerSesion(sesion: Sesion) {
  actual = sesion;
}
