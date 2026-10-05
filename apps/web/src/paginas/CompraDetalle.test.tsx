import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { bffCompras } from '@/test/compras';
import { renderApp } from '@/test/render';
import { BFF, reiniciarCore, servidor } from '@/test/servidor';

const detalle = {
  orderId: 'orden-1',
  fecha: '2026-09-28T16:20:00.000Z',
  sede: 'Monserrat',
  estado: 'COMPLETADA',
  cantidadProductos: 3,
  productos: [
    {
      productoId: 'p-cuaderno',
      nombre: 'Cuaderno A4 UADE',
      cantidad: 2,
      precioUnitario: '1250.00',
      subtotal: '2500.00',
    },
    { nombre: 'Lapicera azul', cantidad: 1, precioUnitario: '1000.00', subtotal: '1000.00' },
  ],
  subtotal: '3500.00',
  total: '3500.00',
};

describe('detalle de una compra', () => {
  beforeEach(() => reiniciarCore(true));

  it('se abre desde el listado y muestra productos, subtotal y total', async () => {
    servidor.use(
      bffCompras(),
      http.get(`${BFF}/compras/:orderId`, ({ params }) =>
        HttpResponse.json({ ...detalle, orderId: params.orderId }),
      ),
    );
    const { router } = renderApp('/compras');
    const lista = await screen.findByRole('list', { name: 'Compras' });
    await userEvent.click(within(lista).getAllByRole('link')[0]!);
    expect(router.state.location.pathname).toBe('/compras/orden-1');

    const tabla = await screen.findByRole('table', { name: 'Productos de la compra' });
    const filas = within(tabla)
      .getAllByRole('row')
      .slice(1)
      .map((f) =>
        within(f)
          .getAllByRole('cell')
          .map((c) => c.textContent),
      );
    expect(filas).toEqual([
      ['Cuaderno A4 UADE', '2', '$ 1.250,00', '$ 2.500,00'],
      ['Lapicera azul', '1', '$ 1.000,00', '$ 1.000,00'],
    ]);
    expect(screen.getByText('Total').nextSibling).toHaveTextContent('$ 3.500,00');
    expect(screen.getByText('Sede Monserrat')).toBeInTheDocument();
  });

  it('una compra inexistente o ajena muestra "no encontrada"', async () => {
    servidor.use(
      http.get(`${BFF}/compras/:orderId`, () =>
        HttpResponse.json(
          { title: 'x', status: 404, code: 'COMPRA_NO_ENCONTRADA', modulo: 'TIENDA' },
          { status: 404 },
        ),
      ),
    );
    renderApp('/compras/de-otro');
    expect(await screen.findByText('No encontramos esa compra')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a mis compras' })).toBeInTheDocument();
  });

  it('si la Tienda no responde, error con reintento', async () => {
    servidor.use(
      http.get(`${BFF}/compras/:orderId`, () =>
        HttpResponse.json(
          { title: 'x', status: 503, code: 'UPSTREAM_UNAVAILABLE', modulo: 'TIENDA' },
          { status: 503 },
        ),
      ),
    );
    renderApp('/compras/orden-1');
    expect(await screen.findByRole('alert')).toHaveTextContent(/Tienda no está disponible/);
  });
});
