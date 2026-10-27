import { Contrato } from '@uadenet/contrato';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { cuerpo, prepararE2E } from './app-e2e';
import { RUTA_SEDES } from './calendario-gateway';
import { fixture } from './fixtures';

const contrato = new Contrato();

// Los casos comparten la app (y su caché de sedes): el orden importa
describe('GET /sedes', () => {
  const e2e = prepararE2E();

  it('si Backoffice no responde, 503 de BACKOFFICE según el contrato', async () => {
    e2e.server.use(http.get(RUTA_SEDES, () => new HttpResponse(null, { status: 503 })));
    const res = await e2e.get('/sedes');
    expect(res.status).toBe(503);
    expect(cuerpo(res)).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', modulo: 'BACKOFFICE' });
    expect(contrato.validar('get', '/sedes', 503, res.body).errores).toEqual([]);
  });

  it('todas las sedes por nombre, con el siteId como id, y el catálogo se pide una vez', async () => {
    let llamadas = 0;
    e2e.server.use(
      http.get(RUTA_SEDES, () => {
        llamadas++;
        return HttpResponse.json(fixture('backoffice/sites.json'));
      }),
    );
    const res = await e2e.get('/sedes');
    expect(res.status).toBe(200);
    expect(contrato.validar('get', '/sedes', 200, res.body).errores).toEqual([]);
    expect(res.body).toEqual({
      items: [
        { id: 'a4c6e8f0-2b4d-4f6a-9c1e-5d7f9b1a3c24', nombre: 'Sede Costa Argentina' },
        { id: '3e9b0a12-55cc-4d77-9a01-6b2f8c4e1d90', nombre: 'Sede Monserrat' },
        { id: '7b1d3f5a-9c2e-4a6b-8d0f-2e4a6c8b0d12', nombre: 'Sede Recoleta' },
      ],
    });
    await e2e.get('/sedes');
    expect(llamadas).toBe(1);
  });
});
