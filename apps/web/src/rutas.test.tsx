import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { core, reiniciarCore } from '@/test/servidor';

describe('rutas protegidas', () => {
  it('sin sesión, una pantalla protegida lleva al login y después vuelve a la ruta pedida', async () => {
    const { router } = renderApp('/calendario?mes=2026-10');
    expect(await screen.findByRole('heading', { name: 'Bienvenido' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/correo institucional/i), 'v.moreno@uade.edu.ar');
    await user.type(screen.getByLabelText(/^contraseña$/i), 'uade2026');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/calendario'));
    expect(router.state.location.search).toBe('?mes=2026-10');
  });

  it('con sesión (cookie de refresh) entra directo, y el login lleva al Home', async () => {
    reiniciarCore(true);
    const { router } = renderApp('/login');
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByRole('heading', { name: /hola/i })).toBeInTheDocument();
  });

  it('una ruta inexistente muestra la página de no encontrada dentro del layout', async () => {
    reiniciarCore(true);
    renderApp('/no-existe');
    expect(await screen.findByText(/no encontramos esta página/i)).toBeInTheDocument();
  });
});

describe('logout', () => {
  it('llama a CORE, borra la sesión y volver atrás no muestra datos', async () => {
    reiniciarCore(true);
    const { router, sesion, queryClient } = renderApp('/');
    const user = userEvent.setup();
    await screen.findByText('Valentina Moreno');

    await user.click(screen.getByRole('button', { name: /cerrar sesión/i }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(core.logouts).toBe(1);
    expect(sesion.token()).toBeNull();
    expect(queryClient.getQueryData(['perfil'])).toBeUndefined();

    await router.navigate(-1);
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(screen.queryByText('Valentina Moreno')).not.toBeInTheDocument();
  });
});
