import { randomUUID } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from 'jose';
import { envDePrueba } from './env';

/** Par de claves de prueba que imita al de CORE, con su JWKS. */
export class EmisorDePrueba {
  private constructor(
    readonly kid: string,
    private readonly privada: CryptoKey,
    readonly jwk: JWK,
  ) {}

  static async crear(kid: string = randomUUID()) {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' };
    return new EmisorDePrueba(kid, privateKey, jwk);
  }

  firmar(
    opciones: {
      sub?: string;
      iss?: string;
      aud?: string;
      exp?: string | number;
      kid?: string;
    } = {},
  ) {
    const jwt = new SignJWT({ email: 'v.moreno@uade.edu.ar', roles: ['STUDENT'] })
      .setProtectedHeader({ alg: 'RS256', kid: opciones.kid ?? this.kid })
      .setIssuer(opciones.iss ?? envDePrueba.JWT_ISSUER)
      .setAudience(opciones.aud ?? envDePrueba.JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(opciones.exp ?? '15m');
    if (opciones.sub !== '') jwt.setSubject(opciones.sub ?? 'alumno-opaco-1');
    return jwt.sign(this.privada);
  }
}
