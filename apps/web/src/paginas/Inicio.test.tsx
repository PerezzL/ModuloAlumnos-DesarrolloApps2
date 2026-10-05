import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calendarioOctubre } from '@/test/calendario';
import { renderApp } from '@/test/render';
import { BFF, GW, reiniciarCore, servidor } from '@/test/servidor';

/** GET /calendario que respeta `categorias`, como el BFF */
function calendarioFiltrado() {
  const pedidos: URL[] = [];
  servidor.use(
    http.get(`${BFF}/calendario`, ({ request }) => {
      const url = new URL(request.url);
      pedidos.push(url);
      const categorias = url.searchParams.get('categorias')?.split(',');
      return HttpResponse.json({
        items: calendarioOctubre.items.filter(
          (i) => !categorias || categorias.includes(i.categoria),
        ),
        fuentes: calendarioOctubre.fuentes.filter(
          (f) => !categorias || categorias.includes(f.categoria),
        ),
      });
    }),
  );
  return pedidos;
}

const tarjeta = (nombre: RegExp) => screen.findByRole('article', { name: nombre });

describe('Inicio (H43)', () => {
  beforeEach(() => {
    // Solo la fecha: msw y los timers siguen reales
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-04T12:00:00-03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('muestra saldo, notificaciones sin leer y el próximo evento o examen, con enlaces', async () => {
    reiniciarCore(true);
    const pedidos = calendarioFiltrado();
    renderApp('/');

    const saldo = await tarjeta(/saldo/i);
    expect(await within(saldo).findByText('$ 13.500,00')).toBeInTheDocument();
    expect(within(saldo).getByRole('link')).toHaveAttribute('href', '/cuenta-corriente');

    const notificaciones = await tarjeta(/notificaciones sin leer/i);
    expect(await within(notificaciones).findByText('2')).toBeInTheDocument();
    expect(within(notificaciones).getByRole('link')).toHaveAttribute('href', '/notificaciones');

    const proximo = await tarjeta(/próximo evento o examen/i);
    expect(
      await within(proximo).findByText('Jornada de Desarrollo de Software'),
    ).toBeInTheDocument();
    expect(within(proximo).getByText(/jueves, 8 de octubre, 18:00/i)).toBeInTheDocument();
    expect(within(proximo).getByRole('link')).toHaveAttribute('href', '/calendario');

    expect(pedidos[0]?.searchParams.get('desde')).toBe('2026-10-04');
    expect(pedidos[0]?.searchParams.get('categorias')).toBe('EVENTO,EXAMEN');
  });

  it('cada tarjeta carga por separado: si falla el saldo, las otras se ven igual', async () => {
    reiniciarCore(true);
    calendarioFiltrado();
    servidor.use(
      http.get(`${GW}/api/v1/wallets/me`, () =>
        HttpResponse.json(
          { title: 'x', status: 503, code: 'UPSTREAM_UNAVAILABLE' },
          { status: 503 },
        ),
      ),
    );
    renderApp('/');

    const saldo = await tarjeta(/^saldo$/i);
    expect(await within(saldo).findByRole('alert')).toHaveTextContent(
      /el saldo no está disponible/i,
    );
    expect(await within(await tarjeta(/sin leer/i)).findByText('2')).toBeInTheDocument();
    expect(
      await within(await tarjeta(/próximo/i)).findByText('Jornada de Desarrollo de Software'),
    ).toBeInTheDocument();
  });

  it('si no cargaron los exámenes, muestra lo que hay y lo avisa', async () => {
    reiniciarCore(true);
    servidor.use(
      http.get(`${BFF}/calendario`, () =>
        HttpResponse.json({
          items: calendarioOctubre.items.filter((i) => i.categoria === 'EVENTO'),
          fuentes: [
            { categoria: 'EVENTO', estado: 'OK' },
            { categoria: 'EXAMEN', estado: 'ERROR', code: 'UPSTREAM_TIMEOUT' },
          ],
        }),
      ),
    );
    renderApp('/');
    const proximo = await tarjeta(/próximo/i);
    expect(await within(proximo).findByText(/no pudimos cargar exámenes/i)).toBeInTheDocument();
    expect(within(proximo).getByText('Jornada de Desarrollo de Software')).toBeInTheDocument();
  });

  it('un turno de examen en curso cuenta como próximo hasta que termina', async () => {
    vi.setSystemTime(new Date('2026-10-21T12:00:00-03:00'));
    reiniciarCore(true);
    calendarioFiltrado();
    renderApp('/');
    const proximo = await tarjeta(/próximo/i);
    expect(await within(proximo).findByText('Mesa especial de octubre 2026')).toBeInTheDocument();
  });
});
