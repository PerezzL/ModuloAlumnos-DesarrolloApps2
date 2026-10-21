import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from './app.js';
import { cargarConfig } from './config.js';

let app: Awaited<ReturnType<typeof crearApp>>['app'];
let demo: string;
let perez: string;

const login = async (email: string) =>
  (await request(app).post('/api/v1/auth/login').send({ email, password: 'uade2026' })).body
    .accessToken as string;
const get = (ruta: string, token = demo) =>
  request(app).get(ruta).set('Authorization', `Bearer ${token}`);
const cargar = (cuerpo: object, clave: string | null = randomUUID(), token = demo) => {
  const pedido = request(app)
    .post('/api/v1/wallets/me/top-ups')
    .set('Authorization', `Bearer ${token}`);
  if (clave) pedido.set('Idempotency-Key', clave);
  return pedido.send(cuerpo);
};
const saldo = async (token = demo) => (await get('/api/v1/wallets/me', token)).body.balance;
const aprobada = { amount: '5000.00', currency: 'ARS', paymentMethodToken: 'mock-approved' };

beforeAll(async () => {
  ({ app } = await crearApp(cargarConfig({})));
  demo = await login('v.moreno@uade.edu.ar');
  perez = await login('j.perez@uade.edu.ar');
});
beforeEach(async () => {
  await request(app).post('/__falso/reset').expect(204);
});

describe('Saldo', () => {
  it('saldo y movimientos del alumno; el saldo cierra con el último movimiento', async () => {
    const wallet = (await get('/api/v1/wallets/me')).body;
    expect(wallet).toEqual({
      walletId: '6d0f5c2e-8b3a-4f1d-9e7c-2a4b6c8d0e1f',
      userId: 'ba310c57-a684-4dbf-a4a4-905fcfbefa08',
      balance: '13500.00',
      currency: 'ARS',
      updatedAt: '2026-10-01T12:30:05.000Z',
    });
    const { items } = (await get('/api/v1/wallets/me/transactions')).body;
    expect(items).toHaveLength(7);
    expect(items[0].balanceAfter).toBe(wallet.balance);
    expect(await saldo(perez)).toBe('0.00');
  });

  it('filtra movimientos por tipo y fechas, y pagina', async () => {
    const debitos = (await get('/api/v1/wallets/me/transactions?type=DEBIT')).body.items;
    expect(debitos).toHaveLength(4);
    const septiembre = (await get('/api/v1/wallets/me/transactions?from=2026-09-01&to=2026-09-30'))
      .body.items;
    expect(septiembre).toHaveLength(4);
    const pagina = (await get('/api/v1/wallets/me/transactions?limit=5')).body;
    expect(pagina.items).toHaveLength(5);
    expect(pagina.nextCursor).not.toBeNull();
    expect((await get('/api/v1/wallets/me/transactions?type=OTRO')).status).toBe(400);
  });

  it('carga aprobada → 201, acredita y aparece primera en los movimientos', async () => {
    const res = await cargar({ ...aprobada, amount: '1234.5' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'POSTED',
      type: 'CREDIT',
      concept: 'TOP_UP',
      amount: '1234.5',
      balanceAfter: '14734.50',
    });
    expect(await saldo()).toBe('14734.50');
    const { items } = (await get('/api/v1/wallets/me/transactions')).body;
    expect(items[0].transactionId).toBe(res.body.transactionId);
  });

  it('una carga repetida con la misma key no duplica', async () => {
    const clave = randomUUID();
    const primera = await cargar(aprobada, clave);
    const segunda = await cargar(aprobada, clave);
    expect(segunda.status).toBe(201);
    expect(segunda.body).toEqual(primera.body);
    expect(await saldo()).toBe('18500.00');
  });

  it('la misma key con otro cuerpo → 409', async () => {
    const clave = randomUUID();
    await cargar(aprobada, clave).expect(201);
    const res = await cargar({ ...aprobada, amount: '1.00' }, clave);
    expect(res.status).toBe(409);
    expect(JSON.parse(res.text).code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('la misma key de otro alumno no choca', async () => {
    const clave = randomUUID();
    await cargar(aprobada, clave).expect(201);
    await cargar(aprobada, clave, perez).expect(201);
    expect(await saldo(perez)).toBe('5000.00');
  });

  it('rechazada → 422 WALLET_TOPUP_REJECTED, sin acreditar; el reintento repite el 422', async () => {
    const clave = randomUUID();
    const rechazada = { ...aprobada, paymentMethodToken: 'mock-rejected' };
    const res = await cargar(rechazada, clave);
    expect(res.status).toBe(422);
    expect(res.type).toBe('application/problem+json');
    expect(JSON.parse(res.text).code).toBe('WALLET_TOPUP_REJECTED');
    expect((await cargar(rechazada, clave)).status).toBe(422);
    expect(await saldo()).toBe('13500.00');
  });

  it('pendiente → 201 PENDING, sin acreditar', async () => {
    const res = await cargar({ ...aprobada, paymentMethodToken: 'mock-pending' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'PENDING', amount: '5000.00' });
    expect(await saldo()).toBe('13500.00');
  });

  it('sin Idempotency-Key → 400 IDEMPOTENCY_KEY_REQUIRED', async () => {
    const res = await cargar(aprobada, null);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.text).code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('valida importe, moneda, medio de pago y formato de la key', async () => {
    expect((await cargar({ ...aprobada, amount: 5000 })).status).toBe(400);
    expect((await cargar({ ...aprobada, amount: '0.00' })).status).toBe(400);
    expect((await cargar({ ...aprobada, amount: '10.999' })).status).toBe(400);
    expect((await cargar({ ...aprobada, currency: 'USD' })).status).toBe(400);
    expect((await cargar({ ...aprobada, paymentMethodToken: '4111111111111111' })).status).toBe(
      400,
    );
    expect((await cargar(aprobada, 'no-es-uuid')).status).toBe(400);
    expect(await saldo()).toBe('13500.00');
  });

  it('sin token → 401', async () => {
    expect((await request(app).get('/api/v1/wallets/me')).status).toBe(401);
  });
});
