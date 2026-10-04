import { screen, within } from '@testing-library/react';
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
