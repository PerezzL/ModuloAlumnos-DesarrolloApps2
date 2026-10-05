import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { reiniciarCore } from '@/test/servidor';

describe('header fijo (H44)', () => {
  it.each(['/', '/calendario', '/cuenta-corriente', '/notificaciones', '/perfil'])(
    'en %s: saldo, campana, navegación, perfil y cerrar sesión',
    async (ruta) => {
      reiniciarCore(true);
      renderApp(ruta);
      const header = await screen.findByRole('banner');
      expect(await within(header).findByText('$ 13.500,00')).toBeInTheDocument();
      expect(within(header).getByRole('button', { name: /notificaciones/i })).toBeInTheDocument();
      const menu = screen.getByRole('complementary', { name: 'Menú' });
      expect(within(menu).getByRole('img', { name: 'UADE' })).toBeInTheDocument();
      expect(within(menu).getByRole('link', { name: /perfil/i })).toBeInTheDocument();
      expect(within(menu).getByRole('button', { name: /cerrar sesión/i })).toBeInTheDocument();
    },
  );

  it('en pantallas chicas el menú se abre desde la barra y se cierra con Escape o al navegar', async () => {
    reiniciarCore(true);
    const { router } = renderApp('/');
    const user = userEvent.setup();
    const abrir = await screen.findByRole('button', { name: /abrir menú/i });
    const menu = screen.getByRole('complementary', { name: 'Menú' });
    expect(abrir).toHaveAttribute('aria-controls', menu.id);

    await user.click(abrir);
    expect(abrir).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(abrir).toHaveAttribute('aria-expanded', 'false');

    await user.click(abrir);
    await user.click(within(menu).getByRole('link', { name: /calendario/i }));
    expect(router.state.location.pathname).toBe('/calendario');
    expect(abrir).toHaveAttribute('aria-expanded', 'false');
  });

  it('tiene un enlace para saltar al contenido', async () => {
    reiniciarCore(true);
    renderApp('/');
    const saltar = await screen.findByRole('link', { name: /saltar al contenido/i });
    expect(saltar).toHaveAttribute('href', '#contenido');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'contenido');
  });
});
