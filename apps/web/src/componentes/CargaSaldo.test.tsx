import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { GW, reiniciarCore, servidor, wallet } from '@/test/servidor';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function abrir() {
  reiniciarCore(true);
  const utils = renderApp('/cuenta-corriente');
  const form = await screen.findByRole('region', { name: /cargar saldo/i });
  return { ...utils, form, user: userEvent.setup() };
}

async function cargar(
  form: HTMLElement,
  user: ReturnType<typeof userEvent.setup>,
  monto: string,
  medio = /se aprueba/i,
) {
  const campo = within(form).getByLabelText(/monto/i);
  await user.clear(campo);
  await user.type(campo, monto);
  await user.click(within(form).getByRole('radio', { name: medio }));
  await user.click(within(form).getByRole('button', { name: /cargar saldo/i }));
}

describe('carga de saldo (H41)', () => {
  it('valida que el monto sea positivo antes de enviar', async () => {
    const { form, user } = await abrir();
    await cargar(form, user, '0');
    expect(within(form).getByText(/mayor a cero/i)).toBeInTheDocument();
    expect(within(form).getByLabelText(/monto/i)).toHaveAttribute('aria-invalid', 'true');
    expect(wallet.keys).toHaveLength(0);
  });

  it('manda el monto como string decimal, ARS y una Idempotency-Key UUID v4', async () => {
    let cuerpo: unknown;
    servidor.events.on('request:start', async ({ request }) => {
      if (request.url.endsWith('/top-ups')) cuerpo = await request.clone().json();
    });
    const { form, user } = await abrir();
    await cargar(form, user, '5.000,50');
    await within(form).findByText(/carga aprobada/i);
    expect(cuerpo).toEqual({
      amount: '5000.50',
      currency: 'ARS',
      paymentMethodToken: 'mock-approved',
    });
    expect(wallet.keys[0]).toMatch(UUID_V4);
    servidor.events.removeAllListeners();
  });

  it('el botón se deshabilita mientras se envía', async () => {
    servidor.use(
      http.post(`${GW}/api/v1/wallets/me/top-ups`, async () => {
        await delay(50);
        return HttpResponse.json({ status: 'PENDING' }, { status: 201 });
      }),
    );
    const { form, user } = await abrir();
    await cargar(form, user, '100');
    expect(within(form).getByRole('button', { name: /procesando/i })).toBeDisabled();
    expect(await within(form).findByRole('button', { name: /cargar saldo/i })).toBeEnabled();
  });

  it('un reintento después de un error de red repite la key y no genera dos cargas', async () => {
    const { form, user } = await abrir();
    // CORE procesa la carga pero la respuesta se pierde en la red
    wallet.perderRespuestas = 1;
    await cargar(form, user, '2000');

    expect(await within(form).findByText(/no pudimos confirmar la carga/i)).toBeInTheDocument();
    expect(within(form).queryByText(/carga rechazada/i)).not.toBeInTheDocument();

    await user.click(within(form).getByRole('button', { name: /reintentar/i }));
    expect(await within(form).findByText(/carga aprobada/i)).toBeInTheDocument();
    expect(wallet.keys).toHaveLength(2);
    expect(wallet.keys[1]).toBe(wallet.keys[0]);
    expect(wallet.acreditaciones).toBe(1);
  });

  it('un envío nuevo del formulario es un intento nuevo, con otra key', async () => {
    const { form, user } = await abrir();
    await cargar(form, user, '100');
    await within(form).findByText(/carga aprobada/i);
    await cargar(form, user, '100');
    await within(form).findByText(/carga aprobada/i);
    expect(wallet.keys).toHaveLength(2);
    expect(wallet.keys[1]).not.toBe(wallet.keys[0]);
    expect(wallet.acreditaciones).toBe(2);
  });
});

describe('resultado de la carga (H42)', () => {
  it('201: confirma y actualiza el saldo y los movimientos', async () => {
    const { form, user } = await abrir();
    await screen.findAllByText('$ 13.500,00');
    await cargar(form, user, '1500');
    expect(await within(form).findByText(/cargaste \$ 1\.500,00/i)).toBeInTheDocument();
    expect((await screen.findAllByText('$ 15.000,00')).length).toBeGreaterThan(0);
    const movimientos = screen.getByRole('region', { name: 'Movimientos' });
    expect(
      await within(movimientos).findByText('+$ 1.500,00', { exact: false }),
    ).toBeInTheDocument();
  });

  it('201 PENDING: avisa que quedó pendiente y no cambia el saldo', async () => {
    const { form, user } = await abrir();
    await cargar(form, user, '700', /pago diferido/i);
    expect(await within(form).findByText(/carga en proceso/i)).toBeInTheDocument();
    expect(wallet.balance).toBe('13500.00');
  });

  it('422: avisa el rechazo y "volver a intentar" arranca un intento nuevo', async () => {
    const { form, user } = await abrir();
    await cargar(form, user, '700', /rechazada/i);
    expect(await within(form).findByText(/el medio de pago rechazó/i)).toBeInTheDocument();

    await user.click(within(form).getByRole('button', { name: /volver a intentar/i }));
    expect(within(form).queryByText(/rechazó/i)).not.toBeInTheDocument();
    await cargar(form, user, '700');
    await within(form).findByText(/carga aprobada/i);
    expect(wallet.keys[1]).not.toBe(wallet.keys[0]);
  });

  it('un 503 de CORE se informa como error del servicio, no como rechazo', async () => {
    servidor.use(
      http.post(`${GW}/api/v1/wallets/me/top-ups`, () =>
        HttpResponse.json(
          { title: 'x', status: 503, code: 'UPSTREAM_UNAVAILABLE' },
          { status: 503 },
        ),
      ),
    );
    const { form, user } = await abrir();
    await cargar(form, user, '700');
    expect(await within(form).findByRole('alert')).toHaveTextContent(/no está disponible/i);
    expect(within(form).queryByText(/carga rechazada/i)).not.toBeInTheDocument();
  });
});
