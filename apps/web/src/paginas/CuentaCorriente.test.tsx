import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { GW, reiniciarCore, servidor } from '@/test/servidor';

const caido = () =>
  servidor.use(
    http.get(`${GW}/api/v1/wallets/me`, () =>
      HttpResponse.json(
        { title: 'Servicio no disponible', status: 503, code: 'UPSTREAM_UNAVAILABLE' },
        { status: 503 },
      ),
    ),
  );

describe('saldo', () => {
  it('se muestra con moneda en el header y en la pantalla, sin pasar por float', async () => {
    reiniciarCore(true);
    renderApp('/cuenta-corriente');
    const tarjeta = await screen.findByRole('region', { name: /saldo disponible/i });
    expect(await within(tarjeta).findByText('$ 13.500,00')).toBeInTheDocument();
    const header = screen.getByRole('banner');
    expect(await within(header).findByText('$ 13.500,00')).toBeInTheDocument();
  });

  it('si CORE no responde, avisa en lugar de mostrar cero', async () => {
    reiniciarCore(true);
    caido();
    renderApp('/cuenta-corriente');
    expect(await screen.findByText(/saldo no disponible/i)).toBeInTheDocument();
    expect(await screen.findByText(/el saldo no está disponible/i)).toBeInTheDocument();
    expect(screen.queryByText(/\$ 0,00/)).not.toBeInTheDocument();
  });
});

describe('movimientos', () => {
  it('lista paginada con concepto, tipo e importe; "ver más" pide la página siguiente', async () => {
    reiniciarCore(true);
    const cursores: (string | null)[] = [];
    servidor.events.on('request:start', ({ request }) => {
      const url = new URL(request.url);
      if (url.pathname.endsWith('/transactions')) cursores.push(url.searchParams.get('cursor'));
    });
    renderApp('/cuenta-corriente');
    const lista = await screen.findByRole('region', { name: 'Movimientos' });
    expect(await within(lista).findAllByRole('listitem')).toHaveLength(10);
    expect(within(lista).getAllByText('Carga de saldo').length).toBeGreaterThan(0);
    expect(within(lista).getAllByText(/^Ingreso:/).length).toBeGreaterThan(0);
    expect(within(lista).getByText('$ 200,00', { exact: false })).toBeInTheDocument();

    await userEvent.click(within(lista).getByRole('button', { name: /ver más/i }));
    expect(await within(lista).findAllByRole('listitem')).toHaveLength(12);
    expect(within(lista).queryByRole('button', { name: /ver más/i })).not.toBeInTheDocument();
    expect(cursores).toEqual([null, '10']);
    servidor.events.removeAllListeners();
  });

  it('sin movimientos muestra el estado vacío', async () => {
    reiniciarCore(true);
    servidor.use(
      http.get(`${GW}/api/v1/wallets/me/transactions`, () =>
        HttpResponse.json({ items: [], nextCursor: null }),
      ),
    );
    renderApp('/cuenta-corriente');
    expect(await screen.findByText(/todavía no tenés movimientos/i)).toBeInTheDocument();
  });
});
