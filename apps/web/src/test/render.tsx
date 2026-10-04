import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { rutas } from '@/rutas';
import { Sesion } from '@/sesion/sesion';
import { SesionProvider } from '@/sesion/SesionProvider';

/** Renderiza la app completa en `ruta`, con una sesión y una caché nuevas. */
export function renderApp(ruta = '/') {
  const sesion = new Sesion();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(rutas, { initialEntries: [ruta] });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <SesionProvider sesion={sesion}>
        <RouterProvider router={router} />
      </SesionProvider>
    </QueryClientProvider>,
  );
  return { ...utils, router, sesion, queryClient };
}
