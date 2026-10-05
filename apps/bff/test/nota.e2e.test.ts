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

  it('materia y comisión del Módulo 9, nota, docente y observaciones del Módulo 2', async () => {
    e2e.server.use(moduloNueve(), ...docenteConFixtures());
    const res = await e2e.get('/cursadas/curso-desa1-2026-2-a/notas/exam-desa1-2026-2-p1');
    expect(res.status).toBe(200);
    validar(200, res.body);
    expect(res.body).toEqual({
      notaId: 'exam-desa1-2026-2-p1',
      instancia: 'PARCIAL',
      titulo: '1er parcial',
      fecha: '2026-09-23',
      nota: 4,
      resultado: 'DESAPROBADO',
      docente: 'Lic. Martín Sosa',
      observaciones: 'Revisar normalización.',
      cursoId: 'curso-desa1-2026-2-a',
      asignatura: { id: 'asig-desa1', codigo: '3.4.207', nombre: 'Desarrollo de Aplicaciones I' },
      comision: 'A - Noche',
    });
  });

  it('pide la nota al Módulo 2 para el alumno del token', async () => {
    let pedido: Record<string, unknown> = {};
    e2e.server.use(
      moduloNueve(),
      http.get(RUTAS_DOCENTE.NOTA, ({ params }) => {
        pedido = { ...params };
        return HttpResponse.json(
          fixture<Record<string, object[]>>('teacher/notas.provisional.json')[
            'curso-bd1-2026-2-a'
          ]![0],
        );
      }),
    );
    const res = await e2e.get('/cursadas/curso-bd1-2026-2-a/notas/exam-bd1-2026-2-p1');
    validar(200, res.body);
    expect(res.body).toMatchObject({ observaciones: null, docente: 'Ing. Laura Gómez' });
    expect(pedido).toEqual({
      cursoId: 'curso-bd1-2026-2-a',
      alumnoId: ALUMNO,
      notaId: 'exam-bd1-2026-2-p1',
    });
  });

  it('una nota inexistente es 404', async () => {
    e2e.server.use(moduloNueve(), ...docenteConFixtures());
    const res = await e2e.get('/cursadas/curso-bd1-2026-2-a/notas/no-existe');
    expect(res.status).toBe(404);
    expect(cuerpo(res)).toMatchObject({ code: 'NOTA_NO_ENCONTRADA' });
    validar(404, cuerpo(res));
  });

  it('una nota de un curso que no es del alumno es 404, aunque el Módulo 2 la tenga', async () => {
    e2e.server.use(
      http.get(RUTAS_ACADEMICO.INSCRIPCIONES, () => HttpResponse.json([])),
      ...docenteConFixtures(),
    );
    const res = await e2e.get('/cursadas/curso-bd1-2026-2-a/notas/exam-bd1-2026-2-p1');
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
      http.get(RUTAS_DOCENTE.NOTA, () => new HttpResponse(null, { status })),
    );
    const res = await e2e.get('/cursadas/curso-bd1-2026-2-a/notas/exam-bd1-2026-2-p1');
    expect(res.status).toBe(status);
    expect(cuerpo(res)).toMatchObject({ code, modulo: 'DOCENTE' });
    validar(status, cuerpo(res));
  });

  it('si falla el Módulo 9, error de GESTION_ACADEMICA', async () => {
    e2e.server.use(
      http.get(RUTAS_ACADEMICO.INSCRIPCIONES, () => new HttpResponse(null, { status: 503 })),
      ...docenteConFixtures(),
    );
    const res = await e2e.get('/cursadas/curso-bd1-2026-2-a/notas/exam-bd1-2026-2-p1');
    expect(res.status).toBe(503);
    expect(cuerpo(res)).toMatchObject({ modulo: 'GESTION_ACADEMICA' });
  });
});
