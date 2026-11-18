import { Contrato } from '@uadenet/contrato';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { RUTAS_ACADEMICO } from './academico-gateway';
import { ALUMNO, cuerpo, prepararE2E } from './app-e2e';
import { docenteConFixtures, RUTAS_DOCENTE } from './docente-gateway';
import { fixture } from './fixtures';

const contrato = new Contrato();
const RUTA = '/cursadas/{cursoId}/notas/{notaId}';
const inscripciones = fixture<object[]>('academic/inscripciones-alumno.provisional.json');
const moduloNueve = () =>
  http.get(RUTAS_ACADEMICO.INSCRIPCIONES, () => HttpResponse.json(inscripciones));
const validar = (status: number, body: unknown) =>
  expect(contrato.validar('get', RUTA, status, body).errores).toEqual([]);

describe('GET /cursadas/{cursoId}/notas/{notaId}', () => {
  const e2e = prepararE2E();

  it('materia y comisión del Módulo 9, nota del Módulo 2 y docente de Backoffice', async () => {
    e2e.server.use(moduloNueve(), ...docenteConFixtures());
    const res = await e2e.get('/cursadas/1006/notas/202');
    expect(res.status).toBe(200);
    validar(200, res.body);
    expect(res.body).toEqual({
      notaId: '202',
      instancia: 'RECUPERATORIO',
      titulo: 'Recuperatorio Parcial 1',
      fecha: '2026-10-28',
      nota: 8,
      resultado: 'APROBADO',
      docente: 'Carla Ruiz',
      cursoId: '1006',
      asignatura: { id: '106', codigo: '3.4.207', nombre: 'Desarrollo de Aplicaciones I' },
      comision: 'A - Noche',
    });
  });

  it('pide las notas del curso al Módulo 2 para el alumno del token', async () => {
    let pedido: Record<string, unknown> = {};
    e2e.server.use(
      moduloNueve(),
      http.get(RUTAS_DOCENTE.NOTAS, ({ params }) => {
        pedido = { ...params };
        return HttpResponse.json(fixture<Record<string, object>>('teacher/grades.json')['1005']);
      }),
      ...docenteConFixtures(),
    );
    const res = await e2e.get('/cursadas/1005/notas/101');
    validar(200, res.body);
    expect(res.body).toMatchObject({ nota: 7, docente: 'Laura Gómez' });
    expect(pedido).toEqual({ cursoId: '1005', alumnoId: ALUMNO });
  });

  it('una nota sin cargar todavía sale sin docente', async () => {
    e2e.server.use(moduloNueve(), ...docenteConFixtures());
    const res = await e2e.get('/cursadas/1005/notas/103');
    validar(200, res.body);
    expect(res.body).toMatchObject({ nota: null, docente: null });
    expect(res.body).not.toHaveProperty('resultado');
  });

  it.each([
    [503, 'Backoffice caído'],
    [404, 'docente que Backoffice no conoce'],
  ])('%i (%s): la nota sale igual, con docente null', async (status) => {
    e2e.server.use(
      moduloNueve(),
      http.get(RUTAS_DOCENTE.USUARIO, () => HttpResponse.json({}, { status })),
      ...docenteConFixtures(),
    );
    // Un docente que ningún test anterior buscó: el nombre se cachea entre pedidos
    const res = await e2e.get('/cursadas/1006/notas/201');
    expect(res.status).toBe(200);
    validar(200, res.body);
    expect(res.body).toMatchObject({ nota: 3.5, docente: null });
  });

  it.each([
    ['inexistente', 'no-existe'],
    ['cancelada', '203'],
  ])('una nota %s es 404', async (_caso, notaId) => {
    e2e.server.use(moduloNueve(), ...docenteConFixtures());
    const res = await e2e.get(`/cursadas/1006/notas/${notaId}`);
    expect(res.status).toBe(404);
    expect(cuerpo(res)).toMatchObject({ code: 'NOTA_NO_ENCONTRADA' });
    validar(404, cuerpo(res));
  });

  it('una nota de un curso que no es del alumno es 404, aunque el Módulo 2 la tenga', async () => {
    e2e.server.use(
      http.get(RUTAS_ACADEMICO.INSCRIPCIONES, () => HttpResponse.json([])),
      ...docenteConFixtures(),
    );
    const res = await e2e.get('/cursadas/1005/notas/101');
    expect(res.status).toBe(404);
    expect(cuerpo(res)).toMatchObject({ code: 'NOTA_NO_ENCONTRADA' });
  });

  it.each([
    [503, 'UPSTREAM_UNAVAILABLE'],
    [504, 'UPSTREAM_TIMEOUT'],
    [502, 'UPSTREAM_INVALID'],
  ])('Módulo 2 %i → %s de DOCENTE: sin nota no hay pantalla', async (status, code) => {
    e2e.server.use(
      moduloNueve(),
      http.get(RUTAS_DOCENTE.NOTAS, () => new HttpResponse(null, { status })),
    );
    const res = await e2e.get('/cursadas/1005/notas/101');
    expect(res.status).toBe(status);
    expect(cuerpo(res)).toMatchObject({ code, modulo: 'DOCENTE' });
    validar(status, cuerpo(res));
  });

  it('si falla el Módulo 9, error de GESTION_ACADEMICA', async () => {
    e2e.server.use(
      http.get(RUTAS_ACADEMICO.INSCRIPCIONES, () => new HttpResponse(null, { status: 503 })),
      ...docenteConFixtures(),
    );
    const res = await e2e.get('/cursadas/1005/notas/101');
    expect(res.status).toBe(503);
    expect(cuerpo(res)).toMatchObject({ modulo: 'GESTION_ACADEMICA' });
  });
});
