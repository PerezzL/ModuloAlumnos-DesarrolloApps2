import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { bffCompras, comprasBase } from '@/test/compras';
import { renderApp } from '@/test/render';
import { BFF, reiniciarCore, servidor } from '@/test/servidor';

const filas = () =>
  within(screen.getByRole('list', { name: 'Compras' })).queryAllByRole('listitem');

describe('historial de compras', () => {
  beforeEach(() => reiniciarCore(true));

  it('lista la primera página con fecha, sede, cantidad, estado y total', async () => {
    servidor.use(bffCompras());
    renderApp('/compras');
    const lista = await screen.findByRole('list', { name: 'Compras' });
    const filas = within(lista).getAllByRole('listitem');
    expect(filas).toHaveLength(10);
    expect(filas[0]).toHaveTextContent('Sede Monserrat · 3 productos');
    expect(filas[0]).toHaveTextContent('Completada');
    expect(filas[0]).toHaveTextContent('$ 3.500,00');
    expect(filas[1]).toHaveTextContent('1 producto');
    expect(filas[2]).toHaveTextContent('Fallida');
  });

  it('"ver más" agrega la página siguiente con el cursor y desaparece al final', async () => {
    const queries: URLSearchParams[] = [];
    servidor.use(bffCompras(undefined, queries));
    renderApp('/compras');
    await screen.findByRole('list', { name: 'Compras' });
    expect(queries[0]!.has('cursor')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Ver más compras' }));
    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: 'Compras' })).getAllByRole('listitem'),
      ).toHaveLength(12),
    );
    expect(queries.at(-1)?.get('cursor')).toBe('orden-10');
    expect(screen.queryByRole('button', { name: 'Ver más compras' })).not.toBeInTheDocument();
  });

  it('un estado que no conocemos se muestra tal como llega', async () => {
    servidor.use(bffCompras([{ ...comprasBase()[0]!, estado: 'REFUNDED' }]));
    renderApp('/compras');
    const lista = await screen.findByRole('list', { name: 'Compras' });
    expect(within(lista).getByText('REFUNDED')).toBeInTheDocument();
  });

  it('sin compras, estado vacío', async () => {
    servidor.use(bffCompras([]));
    renderApp('/compras');
    expect(await screen.findByText('Todavía no hiciste compras')).toBeInTheDocument();
  });

  it('si la Tienda no responde, error con reintento', async () => {
    servidor.use(
      http.get(`${BFF}/compras`, () =>
        HttpResponse.json(
          { title: 'x', status: 503, code: 'UPSTREAM_UNAVAILABLE', modulo: 'TIENDA' },
          { status: 503 },
        ),
      ),
    );
    renderApp('/compras');
    expect(await screen.findByRole('alert')).toHaveTextContent(/Tienda no está disponible/);
  });
});

describe('historial de compras: filtros', () => {
  beforeEach(() => reiniciarCore(true));

  it('filtra por estado, manda el filtro al BFF y arranca de cero', async () => {
    const queries: URLSearchParams[] = [];
    servidor.use(bffCompras(undefined, queries));
    const { router } = renderApp('/compras');
    await screen.findByRole('list', { name: 'Compras' });
    await userEvent.click(screen.getByRole('button', { name: 'Ver más compras' }));
    await waitFor(() => expect(queries.at(-1)?.has('cursor')).toBe(true));

    expect(
      within(screen.getByLabelText('Estado'))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Todos', 'Pago pendiente', 'Completada', 'En reversión', 'Fallida']);
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'Fallida');
    await waitFor(() => expect(filas()).toHaveLength(1));
    expect(Object.fromEntries(queries.at(-1)!)).toEqual({ limit: '10', estado: 'FAILED' });
    expect(router.state.location.search).toBe('?estado=FAILED');
  });

  it('filtra por rango de fechas, combinable con la paginación', async () => {
    const queries: URLSearchParams[] = [];
    servidor.use(bffCompras(undefined, queries));
    renderApp('/compras');
    await screen.findByRole('list', { name: 'Compras' });
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-09-20' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-09-25' } });
    await waitFor(() => expect(filas()).toHaveLength(6));
    expect(queries.at(-1)?.get('desde')).toBe('2026-09-20');
    expect(queries.at(-1)?.get('hasta')).toBe('2026-09-25');
    expect(queries.every((q) => !q.has('sede'))).toBe(true);
  });

  it('un filtro sin resultados muestra un vacío distinto y permite limpiar', async () => {
    servidor.use(bffCompras());
    renderApp('/compras?desde=2027-01-01');
    expect(await screen.findByText('No hay compras con estos filtros')).toBeInTheDocument();
    expect(screen.queryByText('Todavía no hiciste compras')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await waitFor(() => expect(filas()).toHaveLength(10));
  });

  it('con hasta anterior a desde, avisa y no consulta', async () => {
    const queries: URLSearchParams[] = [];
    servidor.use(bffCompras(undefined, queries));
    renderApp('/compras?desde=2026-09-20&hasta=2026-09-01');
    expect(await screen.findByRole('alert')).toHaveTextContent(/no puede ser anterior/);
    expect(queries).toEqual([]);
  });

  it('filtra por sede: las opciones salen del catálogo y al BFF va el id', async () => {
    const queries: URLSearchParams[] = [];
    servidor.use(bffCompras(undefined, queries));
    const { router } = renderApp('/compras');
    await screen.findByRole('list', { name: 'Compras' });
    const sede = screen.getByLabelText('Sede');
    await within(sede).findByRole('option', { name: 'Sede Monserrat' });
    expect(
      within(sede)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Todas', 'Sede Monserrat', 'Sede Recoleta']);

    await userEvent.selectOptions(sede, 'Sede Recoleta');
    await waitFor(() => expect(filas()).toHaveLength(6));
    expect(queries.at(-1)?.get('sede')).toBe('sede-recoleta');
    expect(router.state.location.search).toBe('?sede=sede-recoleta');

    await userEvent.selectOptions(sede, 'Todas');
    await waitFor(() => expect(filas()).toHaveLength(10));
    expect(queries.at(-1)?.has('sede')).toBe(false);
  });

  it('si el catálogo de sedes no carga, el listado funciona igual', async () => {
    servidor.use(
      bffCompras(),
      http.get(`${BFF}/sedes`, () =>
        HttpResponse.json(
          { title: 'x', status: 503, code: 'UPSTREAM_UNAVAILABLE', modulo: 'BACKOFFICE' },
          { status: 503 },
        ),
      ),
    );
    renderApp('/compras?sede=sede-recoleta');
    await waitFor(() => expect(filas()).toHaveLength(6));
    const sede = screen.getByLabelText('Sede');
    expect(sede).toHaveValue('sede-recoleta');
    expect(
      within(sede)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Todas', 'Otra sede']);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
