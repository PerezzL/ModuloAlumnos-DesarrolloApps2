import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { BFF, reiniciarCore, servidor } from '@/test/servidor';

describe('perfil', () => {
  it('muestra los datos de GET /me', async () => {
    reiniciarCore(true);
    servidor.use(
      http.get(`${BFF}/me`, () =>
        HttpResponse.json({
          id: 'a',
          email: 'v.moreno@uade.edu.ar',
          nombre: 'Valentina',
          legajo: '1123456',
          carrera: 'Ingeniería en Informática',
        }),
      ),
    );
    renderApp('/perfil');
    expect(await screen.findByRole('heading', { name: 'Mis datos' })).toBeInTheDocument();
    expect((await screen.findAllByText('1123456')).length).toBe(2);
    expect(screen.getAllByText('Ingeniería en Informática').length).toBeGreaterThan(0);
  });

  it('si Backoffice no responde, avisa, muestra el mail y no cierra la sesión', async () => {
    reiniciarCore(true);
    servidor.use(
      http.get(`${BFF}/me`, () =>
        HttpResponse.json(
          { title: 'x', status: 503, code: 'UPSTREAM_UNAVAILABLE', modulo: 'BACKOFFICE' },
          { status: 503 },
        ),
      ),
    );
    const { router } = renderApp('/perfil');
    expect(await screen.findByRole('alert')).toHaveTextContent(/Backoffice no está disponible/);
    expect(screen.getAllByText('v.moreno@uade.edu.ar').length).toBeGreaterThan(0);
    expect(router.state.location.pathname).toBe('/perfil');
  });
});
