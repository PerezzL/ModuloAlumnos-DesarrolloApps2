import { randomBytes, randomUUID } from 'node:crypto';
import {
  exportJWK,
  generateKeyPair,
  jwtVerify,
  SignJWT,
  type CryptoKey,
  type JWK,
  type JWTPayload,
} from 'jose';
import type { ConfigCore } from './config.js';
import type { UsuarioPrueba } from './usuarios.js';

export interface ClaimsUsuario extends JWTPayload {
  sub: string;
  sid: string;
  email: string;
  roles: string[];
  permissions: string[];
}

interface Sesion {
  sid: string;
  userId: string;
}

/**
 * Emite y valida tokens como CORE: access token RS256 de vida corta y refresh token opaco
 * que rota en cada uso. Las claves se generan al arrancar (no hay nada que commitear).
 */
export class Tokens {
  private constructor(
    private readonly config: ConfigCore,
    private readonly privada: CryptoKey,
    private readonly publica: CryptoKey,
    private readonly jwk: JWK,
  ) {}

  /** refresh token vigente → sesión. Al rotar, el anterior se borra. */
  private readonly refresh = new Map<string, Sesion>();

  static async crear(config: ConfigCore) {
    const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
    const jwk = { ...(await exportJWK(publicKey)), kid: randomUUID(), alg: 'RS256', use: 'sig' };
    return new Tokens(config, privateKey, publicKey, jwk);
  }

  jwks() {
    return { keys: [this.jwk] };
  }

  async emitirAccess(usuario: UsuarioPrueba, sid: string) {
    return new SignJWT({
      sid,
      email: usuario.email,
      roles: usuario.roles,
      permissions: usuario.permissions,
    })
      .setProtectedHeader({ alg: 'RS256', kid: this.jwk.kid })
      .setSubject(usuario.id)
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      .setIssuedAt()
      .setExpirationTime(`${this.config.accessTtlS}s`)
      .setJti(randomUUID())
      .sign(this.privada);
  }

  async verificarAccess(token: string): Promise<ClaimsUsuario | undefined> {
    try {
      const { payload } = await jwtVerify(token, this.publica, {
        issuer: this.config.issuer,
        audience: this.config.audience,
      });
      return payload as ClaimsUsuario;
    } catch {
      return undefined;
    }
  }

  abrirSesion(userId: string) {
    const sid = randomUUID();
    return { sid, refresh: this.nuevoRefresh({ sid, userId }) };
  }

  /** Rota el refresh token: el recibido deja de valer en el acto. */
  rotar(refresh: string): { sesion: Sesion; refresh: string } | undefined {
    const sesion = this.refresh.get(refresh);
    if (!sesion) return undefined;
    this.refresh.delete(refresh);
    return { sesion, refresh: this.nuevoRefresh(sesion) };
  }

  cerrarSesion(sid: string) {
    for (const [token, sesion] of this.refresh) {
      if (sesion.sid === sid) this.refresh.delete(token);
    }
  }

  sesionDeRefresh(refresh: string) {
    return this.refresh.get(refresh);
  }

  private nuevoRefresh(sesion: Sesion) {
    const token = randomBytes(32).toString('base64url');
    this.refresh.set(token, sesion);
    return token;
  }
}
