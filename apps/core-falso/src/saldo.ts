import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { requiereUsuario } from './auth.js';
import { fixture } from './fixtures.js';
import { ALUMNO_DEMO } from './modulos/comun.js';
import { paginar, QueryInvalida } from './paginacion.js';
import { enviarProblema } from './problema.js';
import type { Tokens } from './tokens.js';

/** Movimiento, como en el OpenAPI de CORE */
interface Transaccion {
  transactionId: string;
  status: 'POSTED' | 'PENDING';
  type: 'CREDIT' | 'DEBIT' | 'REVERSAL';
  concept: string;
  amount: string;
  currency: 'ARS';
  balanceAfter: string | null;
  externalReference: string;
  originalTransactionId: string | null;
  createdAt: string;
}

interface Wallet {
  walletId: string;
  /** En centavos: los importes nunca pasan por float */
  saldo: bigint;
  transacciones: Transaccion[];
  updatedAt: string;
}

interface RespuestaGuardada {
  huella: string;
  status: number;
  cuerpo: unknown;
  problema: boolean;
}

const IMPORTE = /^\d{1,12}(\.\d{1,2})?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPOS = new Set(['CREDIT', 'DEBIT', 'REVERSAL']);

const aCentavos = (importe: string) => {
  const [enteros = '0', decimales = ''] = importe.split('.');
  return BigInt(enteros) * 100n + BigInt(decimales.padEnd(2, '0'));
};
const aImporte = (centavos: bigint) =>
  `${centavos / 100n}.${String(centavos % 100n).padStart(2, '0')}`;

/** `to` con solo fecha incluye ese día entero */
const limite = (valor: unknown, finDelDia: boolean) => {
  if (valor === undefined) return undefined;
  const texto = String(valor);
  const ms = Date.parse(
    finDelDia && /^\d{4}-\d{2}-\d{2}$/.test(texto) ? `${texto}T23:59:59.999Z` : texto,
  );
  if (Number.isNaN(ms)) throw new QueryInvalida('from y to deben ser ISO 8601');
  return ms;
};

/**
 * Saldo en memoria (sección 7 de CORE_INTEGRACION.md). Solo lo que usa el portal: consulta,
 * movimientos y carga con `mock-approved` (201 `POSTED`), `mock-rejected` (422) y `mock-pending`
 * (201 `PENDING`; la carga pendiente no se resuelve nunca).
 */
export class Saldos {
  private wallets = new Map<string, Wallet>();
  /** `${userId}:${Idempotency-Key}` → respuesta original */
  private respuestas = new Map<string, RespuestaGuardada>();

  constructor() {
    this.reiniciar();
  }

  reiniciar() {
    const { walletId, balance, updatedAt } = fixture<{
      walletId: string;
      balance: string;
      updatedAt: string;
    }>('core/wallet-me.json');
    const { items } = fixture<{ items: Transaccion[] }>('core/transacciones.json');
    this.wallets = new Map([
      [ALUMNO_DEMO, { walletId, saldo: aCentavos(balance), transacciones: items, updatedAt }],
    ]);
    this.respuestas.clear();
  }

  wallet(userId: string) {
    let wallet = this.wallets.get(userId);
    if (!wallet) {
      wallet = {
        walletId: randomUUID(),
        saldo: 0n,
        transacciones: [],
        updatedAt: new Date().toISOString(),
      };
      this.wallets.set(userId, wallet);
    }
    return wallet;
  }

  respuestaGuardada(userId: string, clave: string) {
    return this.respuestas.get(`${userId}:${clave}`);
  }

  guardarRespuesta(userId: string, clave: string, respuesta: RespuestaGuardada) {
    this.respuestas.set(`${userId}:${clave}`, respuesta);
  }

  acreditar(userId: string, amount: string): Transaccion {
    const wallet = this.wallet(userId);
    wallet.saldo += aCentavos(amount);
    const transactionId = randomUUID();
    const transaccion: Transaccion = {
      transactionId,
      status: 'POSTED',
      type: 'CREDIT',
      concept: 'TOP_UP',
      amount,
      currency: 'ARS',
      balanceAfter: aImporte(wallet.saldo),
      externalReference: `top-up/${transactionId}`,
      originalTransactionId: null,
      createdAt: new Date().toISOString(),
    };
    wallet.transacciones.unshift(transaccion);
    wallet.updatedAt = transaccion.createdAt;
    return transaccion;
  }
}

export function routerSaldo(tokens: Tokens, saldos: Saldos) {
  const router = Router();
  router.use(requiereUsuario(tokens));

  router.get('/me', (_req, res) => {
    const userId: string = res.locals.usuarioId;
    const { walletId, saldo, updatedAt } = saldos.wallet(userId);
    res.json({ walletId, userId, balance: aImporte(saldo), currency: 'ARS', updatedAt });
  });

  router.get('/me/transactions', (req, res) => {
    const { type, from, to, cursor, limit } = req.query;
    try {
      if (type !== undefined && !TIPOS.has(String(type))) {
        throw new QueryInvalida('type debe ser CREDIT, DEBIT o REVERSAL');
      }
      const desde = limite(from, false) ?? -Infinity;
      const hasta = limite(to, true) ?? Infinity;
      const filtradas = saldos
        .wallet(res.locals.usuarioId)
        .transacciones.filter((t) => type === undefined || t.type === type)
        .filter((t) => Date.parse(t.createdAt) >= desde && Date.parse(t.createdAt) <= hasta);
      res.json(paginar(filtradas, cursor, limit));
    } catch (error) {
      if (!(error instanceof QueryInvalida)) throw error;
      enviarProblema(res, 400, 'VALIDATION_ERROR', error.message);
    }
  });

  router.post('/me/top-ups', (req, res) => {
    const userId: string = res.locals.usuarioId;
    const clave = req.header('idempotency-key');
    if (!clave) {
      return enviarProblema(res, 400, 'IDEMPOTENCY_KEY_REQUIRED', 'Falta Idempotency-Key');
    }
    if (!UUID.test(clave)) {
      return enviarProblema(res, 400, 'VALIDATION_ERROR', 'Idempotency-Key debe ser un UUID');
    }

    const { amount, currency, paymentMethodToken } = (req.body ?? {}) as Record<string, unknown>;
    const huella = JSON.stringify([amount, currency, paymentMethodToken]);
    const previa = saldos.respuestaGuardada(userId, clave);
    if (previa) {
      if (previa.huella !== huella) {
        return enviarProblema(
          res,
          409,
          'IDEMPOTENCY_CONFLICT',
          'La Idempotency-Key ya se usó con otro pedido',
        );
      }
      // Reintento del mismo intento: la respuesta original, sin acreditar de nuevo
      res.type(previa.problema ? 'application/problem+json' : 'application/json');
      return res.status(previa.status).send(JSON.stringify(previa.cuerpo));
    }

    if (typeof amount !== 'string' || !IMPORTE.test(amount) || aCentavos(amount) <= 0n) {
      return enviarProblema(res, 400, 'VALIDATION_ERROR', 'amount debe ser un decimal positivo');
    }
    if (currency !== 'ARS') {
      return enviarProblema(res, 400, 'VALIDATION_ERROR', 'currency debe ser ARS');
    }

    const responder = (status: number, cuerpo: unknown, problema = false) => {
      saldos.guardarRespuesta(userId, clave, { huella, status, cuerpo, problema });
      res.type(problema ? 'application/problem+json' : 'application/json');
      res.status(status).send(JSON.stringify(cuerpo));
    };

    switch (paymentMethodToken) {
      case 'mock-approved':
        return responder(201, saldos.acreditar(userId, amount));
      case 'mock-pending': {
        const transactionId = randomUUID();
        return responder(201, {
          transactionId,
          status: 'PENDING',
          type: 'CREDIT',
          concept: 'TOP_UP',
          amount,
          currency,
          balanceAfter: null,
          externalReference: `top-up/${transactionId}`,
          originalTransactionId: null,
          createdAt: new Date().toISOString(),
        });
      }
      case 'mock-rejected':
        return responder(
          422,
          {
            type: 'about:blank',
            title: 'Carga rechazada',
            status: 422,
            code: 'WALLET_TOPUP_REJECTED',
            detail: 'El medio de pago rechazó la carga.',
            correlationId: res.getHeader('X-Correlation-Id'),
          },
          true,
        );
      default:
        return enviarProblema(
          res,
          400,
          'VALIDATION_ERROR',
          'paymentMethodToken debe ser mock-approved, mock-rejected o mock-pending',
        );
    }
  });

  return router;
}
