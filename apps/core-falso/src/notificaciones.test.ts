import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from './app.js';
import { cargarConfig } from './config.js';
import type { Notificacion } from './notificaciones.js';

let app: Awaited<ReturnType<typeof crearApp>>['app'];
let servidor: Server;
let url: string;
let demo: string;
let perez: string;
const sockets: Socket[] = [];

const login = async (email: string) =>
  (await request(app).post('/api/v1/auth/login').send({ email, password: 'uade2026' })).body
    .accessToken as string;
const get = (ruta: string, token = demo) =>
  request(app).get(ruta).set('Authorization', `Bearer ${token}`);
const disparar = (cuerpo: object) => request(app).post('/__falso/notificaciones').send(cuerpo);

/** Conecta y espera el handshake; rechaza con el error de conexión */
const conectar = (auth: object) =>
  new Promise<Socket>((ok, falla) => {
    const socket = io(`${url}/notifications`, { auth, transports: ['websocket'] });
    sockets.push(socket);
    socket.on('connect', () => ok(socket));
    socket.on('connect_error', falla);
  });

beforeAll(async () => {
  const creada = await crearApp(cargarConfig({}));
  app = creada.app;
  servidor = app.listen(0);
  creada.conectarSocket(servidor);
  url = `http://localhost:${(servidor.address() as AddressInfo).port}`;
  demo = await login('v.moreno@uade.edu.ar');
  perez = await login('j.perez@uade.edu.ar');
});
beforeEach(async () => {
  await request(app).post('/__falso/reset').expect(204);
});
afterEach(() => {
  for (const socket of sockets.splice(0)) socket.disconnect();
});
afterAll(() => new Promise((ok) => servidor.close(ok)));

describe('Notificaciones por socket.io', () => {
  it('una notificación disparada llega al socket del alumno y queda en el listado', async () => {
    const socket = await conectar({ token: demo });
    const recibida = new Promise<Notificacion>((ok) => socket.on('notification.created', ok));

    const res = await disparar({ tipo: 'EVENT_REMINDER', email: 'v.moreno@uade.edu.ar' });
    expect(res.status).toBe(201);

    const notificacion = await recibida;
    expect(notificacion).toEqual(res.body);
    expect(notificacion).toMatchObject({ type: 'EVENT_REMINDER', readAt: null });
    const listado = await get('/api/v1/notifications');
    expect(listado.body.items[0]).toEqual(notificacion);
  });

  it('no llega a otro alumno, aunque mande un userId en el handshake', async () => {
    const ajeno = await conectar({
      token: perez,
      userId: 'ba310c57-a684-4dbf-a4a4-905fcfbefa08',
    });
    const propio = await conectar({ token: demo });
    let recibidasAjeno = 0;
    ajeno.on('notification.created', () => recibidasAjeno++);
    const llegoAlPropio = new Promise((ok) => propio.on('notification.created', ok));

    await disparar({ tipo: 'LIBRARY_PENALTY_APPLIED' });
    await llegoAlPropio;
    expect(recibidasAjeno).toBe(0);
  });

  it('sin token o con token inválido rechaza la conexión', async () => {
    await expect(conectar({})).rejects.toThrow('AUTH_TOKEN_INVALID');
    await expect(conectar({ token: 'x' })).rejects.toThrow('AUTH_TOKEN_INVALID');
  });

  it('el endpoint de prueba valida tipo y usuario', async () => {
    expect((await disparar({ tipo: 'OTRO' })).status).toBe(400);
    expect((await disparar({ tipo: 'EVENT_REMINDER', email: 'nadie@uade.edu.ar' })).status).toBe(
      404,
    );
  });
});

describe('Notificaciones por REST', () => {
  it('lista las propias, más nuevas primero, con filtros', async () => {
    const todas = (await get('/api/v1/notifications')).body;
    expect(todas.nextCursor).toBeNull();
    expect(todas.items.map((n: Notificacion) => n.type)).toEqual([
      'EVENT_REMINDER',
      'TEACHER_EXAM_RESULT_PUBLISHED',
      'LIBRARY_PENALTY_APPLIED',
    ]);
    expect((await get('/api/v1/notifications?read=false')).body.items).toHaveLength(2);
    expect(
      (await get('/api/v1/notifications?type=TEACHER_EXAM_RESULT_PUBLISHED')).body.items,
    ).toHaveLength(1);
    expect((await get('/api/v1/notifications', perez)).body).toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it('pagina con cursor opaco', async () => {
    const primera = (await get('/api/v1/notifications?limit=2')).body;
    expect(primera.items).toHaveLength(2);
    const segunda = (await get(`/api/v1/notifications?limit=2&cursor=${primera.nextCursor}`)).body;
    expect(segunda.items).toHaveLength(1);
    expect(segunda.nextCursor).toBeNull();
    expect((await get('/api/v1/notifications?limit=101')).status).toBe(400);
  });

  it('unread-count, marcar leída y read-all', async () => {
    expect((await get('/api/v1/notifications/unread-count')).body).toEqual({ count: 2 });

    const id = (await get('/api/v1/notifications?read=false')).body.items[0].id;
    const marcada = await request(app)
      .patch(`/api/v1/notifications/${id}`)
      .set('Authorization', `Bearer ${demo}`)
      .send({ read: true });
    expect(marcada.body).toMatchObject({ id, readAt: expect.any(String) });
    expect((await get('/api/v1/notifications/unread-count')).body).toEqual({ count: 1 });

    await request(app)
      .post('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${demo}`)
      .expect(204);
    expect((await get('/api/v1/notifications/unread-count')).body).toEqual({ count: 0 });
  });

  it('no deja marcar la notificación de otro alumno', async () => {
    const id = (await get('/api/v1/notifications')).body.items[0].id;
    const res = await request(app)
      .patch(`/api/v1/notifications/${id}`)
      .set('Authorization', `Bearer ${perez}`)
      .send({ read: true });
    expect(res.status).toBe(404);
  });

  it('sin token → 401', async () => {
    expect((await request(app).get('/api/v1/notifications')).status).toBe(401);
  });
});
