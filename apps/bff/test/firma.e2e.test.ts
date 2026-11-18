import { randomUUID } from 'node:crypto';
import { http, HttpResponse } from 'msw';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { RUTAS_ACADEMICO, USUARIO_CON_PLAN } from './academico-gateway';
import { ALUMNO, headersFirmados, prepararE2E } from './app-e2e';

// El BFF solo acepta pedidos firmados por el Gateway de CORE
describe('firma del Gateway', () => {
  const e2e = prepararE2E();
  const pedirMe = (headers: Record<string, string>) =>
    request(e2e.app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${e2e.token}`)
      .set(headers);
  const esFirmaInvalida = (res: request.Response) => {
    expect(res.status).toBe(403);
    expect(res.headers['content-type']).toMatch(/problem\+json/);
    expect(JSON.parse(res.text).code).toBe('GATEWAY_SIGNATURE_INVALID');
  };

  it('un pedido bien firmado pasa', async () => {
    e2e.server.use(http.get(RUTAS_ACADEMICO.USUARIO, () => HttpResponse.json(USUARIO_CON_PLAN)));
    const res = await pedirMe(headersFirmados('GET', '/api/v1/me'));
    expect(res.status).not.toBe(403);
  });

  it('sin firma → 403', async () => esFirmaInvalida(await pedirMe({ 'X-User-Id': ALUMNO })));

  it('firma de otra ruta → 403', async () =>
    esFirmaInvalida(await pedirMe(headersFirmados('GET', '/api/v1/calendario'))));

  it('X-User-Id cambiado después de firmar → 403', async () =>
    esFirmaInvalida(
      await pedirMe({ ...headersFirmados('GET', '/api/v1/me'), 'X-User-Id': 'otro-alumno' }),
    ));

  it('timestamp viejo → 403', async () =>
    esFirmaInvalida(
      await pedirMe(headersFirmados('GET', '/api/v1/me', { timestamp: Date.now() - 6 * 60_000 })),
    ));

  it('el 403 conserva el correlation id del pedido', async () => {
    const correlationId = randomUUID();
    const res = await pedirMe({ 'X-User-Id': ALUMNO, 'X-Correlation-Id': correlationId });
    esFirmaInvalida(res);
    expect(res.headers['x-correlation-id']).toBe(correlationId);
  });

  it.each(['/health/live', '/health/ready', '/api/v1/health/live', '/docs-json'])(
    '%s no pide firma',
    async (ruta) => {
      const res = await request(e2e.app.getHttpServer()).get(ruta);
      expect(res.status).toBe(200);
    },
  );
});
