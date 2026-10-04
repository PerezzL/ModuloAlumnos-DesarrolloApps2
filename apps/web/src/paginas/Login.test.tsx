import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { GW, servidor } from '@/test/servidor';

async function completar(email: string, password = 'uade2026') {
  const user = userEvent.setup();
  renderApp('/login');
  await user.type(await screen.findByLabelText(/correo institucional/i), email);
  await user.type(screen.getByLabelText(/^contraseña$/i), password);
  return user;
}

describe('Login', () => {
  it('con credenciales correctas entra al Home', async () => {
    const user = await completar('v.moreno@uade.edu.ar');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));
    expect(await screen.findByRole('heading', { name: /hola, valentina/i })).toBeInTheDocument();
  });

  it('un mail fuera de @uade.edu.ar muestra el error y no llama a CORE', async () => {
    let llamadas = 0;
    servidor.use(
      http.post(`${GW}/api/v1/auth/login`, () => {
        llamadas++;
        return HttpResponse.json({});
      }),
    );
    const user = await completar('v.moreno@gmail.com');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));
    expect(screen.getByText(/debe pertenecer al dominio/i)).toBeInTheDocument();
    expect(llamadas).toBe(0);
  });

  it('valida el dominio al salir del campo', async () => {
    const user = userEvent.setup();
    renderApp('/login');
    await user.type(await screen.findByLabelText(/correo institucional/i), 'a@a.a');
    await user.tab();
    expect(screen.getByText(/debe pertenecer al dominio/i)).toBeInTheDocument();
  });

  it('credenciales inválidas: mensaje genérico', async () => {
    const user = await completar('v.moreno@uade.edu.ar', 'otra');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/el usuario o la contraseña son incorrectos/i);
  });

  it.each([
    ['suspendido@uade.edu.ar', /cuenta suspendida/i],
    ['bloqueado@uade.edu.ar', /demasiados intentos/i],
  ])('%s muestra su mensaje propio', async (email, mensaje) => {
    const user = await completar(email);
    await user.click(screen.getByRole('button', { name: /ingresar/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
  });

  it('deshabilita el botón mientras se envía', async () => {
    servidor.use(
      http.post(`${GW}/api/v1/auth/login`, async () => {
        await delay('infinite');
        return HttpResponse.json({});
      }),
    );
    const user = await completar('v.moreno@uade.edu.ar');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /ingresando/i })).toBeDisabled());
  });
});
