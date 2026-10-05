import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from './app.js';
import { cargarConfig } from './config.js';

const DEMO = 'ba310c57-a684-4dbf-a4a4-905fcfbefa08';
const config = cargarConfig({ CORE_GATEWAY_TIMEOUT_MS: '200' });
let app: Awaited<ReturnType<typeof crearApp>>['app'];
let demo: string;
let perez: string;

const login = async (email: string) =>
  (await request(app).post('/api/v1/auth/login').send({ email, password: 'uade2026' })).body
    .accessToken as string;
const get = (ruta: string, token = demo) =>
  request(app).get(ruta).set('Authorization', `Bearer ${token}`);
const inscribir = (cursoId: string, alumnoId = DEMO) =>
  request(app)
    .post(`/api/v1/academic/planificacion/cursos/${cursoId}/inscripciones`)
    .set('Authorization', `Bearer ${demo}`)
    .send({ alumnoId });

beforeAll(async () => {
  ({ app } = await crearApp(config));
  demo = await login('v.moreno@uade.edu.ar');
  perez = await login('j.perez@uade.edu.ar');
});
beforeEach(async () => {
  await request(app).post('/__falso/reset').expect(204);
});

describe('Módulos externos desde fixtures', () => {
  it('cada prefijo responde con su fixture', async () => {
    const rutas = [
      '/api/v1/dining/reservations/me',
      '/api/v1/events/eventos',
      '/api/v1/store/orders/me',
      `/api/v1/backoffice/users/${DEMO}`,
      '/api/v1/academic/planificacion/periodos',
      '/api/v1/academic/planificacion/turnos-examen',
      '/api/v1/academic/planificacion/cursos?periodoId=2027-1&planId=plan-2020',
      '/api/v1/academic/academica/asignaturas/asig-so/correlatividades',
      `/api/v1/academic/planificacion/alumnos/${DEMO}/inscripciones`,
      `/api/v1/teacher/cursos/curso-bd1-2026-2-a/alumnos/${DEMO}/asistencia`,
      `/api/v1/teacher/cursos/curso-desa1-2026-2-a/alumnos/${DEMO}/notas`,
    ];
    for (const ruta of rutas) {
      const res = await get(ruta);
      expect(res.status, ruta).toBe(200);
      expect(res.body, ruta).toBeTruthy();
    }
  });

  it('sin token → 401, igual que el resto del Gateway', async () => {
    const res = await request(app).get('/api/v1/dining/reservations/me');
    expect(res.status).toBe(401);
  });

  it('el alumno sin datos recibe listas vacías', async () => {
    expect((await get('/api/v1/dining/reservations/me', perez)).body).toEqual({ reservations: [] });
    expect((await get('/api/v1/store/orders/me', perez)).body.items).toEqual([]);
    const eventos = (await get('/api/v1/events/eventos', perez)).body as { yaInscripto: boolean }[];
    expect(eventos.every((e) => !e.yaInscripto)).toBe(true);
  });

  it('eventos: filtra por solapamiento y ordena por inicio', async () => {
    const res = await get('/api/v1/events/eventos?desde=2026-10-01&hasta=2026-10-31T23:59:59Z');
    const titulos = (res.body as { titulo: string }[]).map((e) => e.titulo);
    // El del 30/09 al 02/10 aparece en octubre; el de noviembre no
    expect(titulos).toEqual([
      'Semana de la Ingeniería',
      'Jornada de Desarrollo de Software',
      'Taller de oratoria',
    ]);
  });

  it('tienda: solo ve sus propias compras', async () => {
    const id = '93b28f67-e111-4a0d-b857-fdd015c4d3f1';
    expect((await get(`/api/v1/store/orders/${id}`)).status).toBe(200);
    expect((await get(`/api/v1/store/orders/${id}`, perez)).status).toBe(404);
  });

  it('tienda: filtra por fecha (inclusive, en hora argentina), estado y sede', async () => {
    const ids = async (query: string) =>
      ((await get(`/api/v1/store/orders/me?${query}`)).body as { items: { orderId: string }[] })
        .items.length;
    expect(await ids('desde=2026-09-10&hasta=2026-09-28')).toBe(2);
    expect(await ids('desde=2026-09-29')).toBe(0);
    expect(await ids('estado=CANCELADA')).toBe(1);
    expect(await ids('sede=Recoleta')).toBe(1);
    const res = await get('/api/v1/store/orders/me?estado=COMPLETADA&limit=1');
    expect(res.body).toMatchObject({ total: 2, limit: 1 });
  });

  it('docente: la nota se pide por el examId del actionUrl de la notificación', async () => {
    const base = `/api/v1/teacher/cursos/curso-bd1-2026-2-a/alumnos/${DEMO}/notas`;
    const res = await get(`${base}/exam-bd1-2026-2-p1`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ examId: 'exam-bd1-2026-2-p1', nota: 7 });
    expect((await get(`${base}/no-existe`)).status).toBe(404);
  });

  it('una ruta inexistente del módulo → 404 problem+json', async () => {
    const res = await get('/api/v1/dining/no-existe');
    expect(res.status).toBe(404);
    expect(res.type).toBe('application/problem+json');
  });
});

describe('Inscripción con estado en memoria', () => {
  const cupoDe = async (cursoId: string) =>
    (
      (await get('/api/v1/academic/planificacion/cursos?periodoId=2027-1')).body as {
        id: string;
        inscriptosActivos: number;
      }[]
    ).find((c) => c.id === cursoId)?.inscriptosActivos;

  it('una inscripción hecha se ve en la oferta y en el historial; el reset la borra', async () => {
    expect(await cupoDe('curso-so-2027-1-a')).toBe(10);

    const res = await inscribir('curso-so-2027-1-a');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ cursoId: 'curso-so-2027-1-a', estado: 'INSCRIPTO' });

    expect(await cupoDe('curso-so-2027-1-a')).toBe(11);
    const historial = await get(
      `/api/v1/academic/planificacion/alumnos/${DEMO}/inscripciones?periodoId=2027-1`,
    );
    expect(historial.body).toEqual([
      expect.objectContaining({
        cursoId: 'curso-so-2027-1-a',
        estado: 'INSCRIPTO',
        periodo: { id: '2027-1', nombre: '1° cuatrimestre 2027' },
      }),
    ]);

    await request(app).post('/__falso/reset').expect(204);
    expect(await cupoDe('curso-so-2027-1-a')).toBe(10);
  });

  it('dos veces la misma asignatura → 409 YA_INSCRIPTO', async () => {
    await inscribir('curso-so-2027-1-a').expect(201);
    const res = await inscribir('curso-so-2027-1-a');
    expect(res.status).toBe(409);
    expect(JSON.parse(res.text).code).toBe('YA_INSCRIPTO');
  });

  it('comisión llena → 409 SIN_CUPO', async () => {
    const res = await inscribir('curso-ayed-2027-1-a');
    expect(JSON.parse(res.text).code).toBe('SIN_CUPO');
  });

  it('correlativa no cumplida → 409 CORRELATIVIDAD_FALTANTE con el detalle', async () => {
    const res = await inscribir('curso-desa2-2027-1-a');
    expect(res.status).toBe(409);
    expect(JSON.parse(res.text)).toMatchObject({
      code: 'CORRELATIVIDAD_FALTANTE',
      correlativasFaltantes: [{ asignaturaId: 'asig-desa1', tipo: 'REGULAR' }],
    });
  });

  it('curso inexistente → 404', async () => {
    expect((await inscribir('no-existe')).status).toBe(404);
  });
});

describe('Fallas simuladas', () => {
  const ponerFalla = (modulo: string, cuerpo: object) =>
    request(app).put(`/__falso/fallas/${modulo}`).send(cuerpo);

  it('caido → 503 UPSTREAM_UNAVAILABLE solo en ese módulo', async () => {
    await ponerFalla('dining', { tipo: 'caido' }).expect(200);
    const caido = await get('/api/v1/dining/reservations/me');
    expect(caido.status).toBe(503);
    expect(JSON.parse(caido.text).code).toBe('UPSTREAM_UNAVAILABLE');
    expect((await get('/api/v1/events/eventos')).status).toBe(200);

    await request(app).delete('/__falso/fallas/dining').expect(200);
    expect((await get('/api/v1/dining/reservations/me')).status).toBe(200);
  });

  it('invalido → 502 UPSTREAM_INVALID', async () => {
    await ponerFalla('academic', { tipo: 'invalido' }).expect(200);
    const res = await get('/api/v1/academic/planificacion/periodos');
    expect(res.status).toBe(502);
    expect(JSON.parse(res.text).code).toBe('UPSTREAM_INVALID');
  });

  it('lento sin demora → 504 UPSTREAM_TIMEOUT; lento con demora menor responde', async () => {
    await ponerFalla('events', { tipo: 'lento' }).expect(200);
    const res = await get('/api/v1/events/eventos');
    expect(res.status).toBe(504);
    expect(JSON.parse(res.text).code).toBe('UPSTREAM_TIMEOUT');

    await ponerFalla('events', { tipo: 'lento', demoraMs: 50 }).expect(200);
    expect((await get('/api/v1/events/eventos')).status).toBe(200);
  });

  it('valida el módulo y el tipo', async () => {
    expect((await ponerFalla('comedor', { tipo: 'caido' })).status).toBe(404);
    expect((await ponerFalla('dining', { tipo: 'roto' })).status).toBe(400);
    expect((await ponerFalla('dining', { tipo: 'caido', demoraMs: 10 })).status).toBe(400);
  });

  it('CORE_FALLAS las carga al arrancar y el reset vuelve a ellas', async () => {
    const otra = (await crearApp(cargarConfig({ CORE_FALLAS: 'dining:caido, events:lento:3000' })))
      .app;
    expect((await request(otra).get('/__falso/fallas')).body).toEqual({
      dining: { tipo: 'caido' },
      events: { tipo: 'lento', demoraMs: 3000 },
    });
    await request(otra).delete('/__falso/fallas/dining');
    await request(otra).post('/__falso/reset');
    expect((await request(otra).get('/__falso/fallas')).body).toHaveProperty('dining');
  });

  it('CORE_FALLAS con un módulo desconocido no arranca', async () => {
    await expect(crearApp(cargarConfig({ CORE_FALLAS: 'comedor:caido' }))).rejects.toThrow(
      'comedor',
    );
  });
});

describe('Destino real configurado', () => {
  it('con {MODULO}_SERVICE_URL reenvía por red en lugar de usar la fixture', async () => {
    const otra = (await crearApp(cargarConfig({ DINING_SERVICE_URL: 'http://localhost:1/api/v1' })))
      .app;
    const token = (
      await request(otra)
        .post('/api/v1/auth/login')
        .send({ email: 'v.moreno@uade.edu.ar', password: 'uade2026' })
    ).body.accessToken as string;
    const res = await request(otra)
      .get('/api/v1/dining/reservations/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(503);
  });
});
