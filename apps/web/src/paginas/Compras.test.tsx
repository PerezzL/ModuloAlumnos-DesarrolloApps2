import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { bffCompras } from '@/test/compras';
import { renderApp } from '@/test/render';
import { BFF, reiniciarCore, servidor } from '@/test/servidor';

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
    expect(filas[2]).toHaveTextContent('Cancelada');
    expect(screen.getByText('12 compras · Página 1 de 2')).toBeInTheDocument();
  });

  it('pagina hacia adelante y atrás, con la página en la URL', async () => {
    const queries: URLSearchParams[] = [];
    servidor.use(bffCompras(undefined, queries));
    const { router } = renderApp('/compras');
    await screen.findByText('12 compras · Página 1 de 2');
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(await screen.findByText('12 compras · Página 2 de 2')).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Compras' })).getAllByRole('listitem'),
    ).toHaveLength(2);
    expect(router.state.location.search).toBe('?pagina=2');
    expect(queries.at(-1)?.get('page')).toBe('2');
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }));
    expect(await screen.findByText('12 compras · Página 1 de 2')).toBeInTheDocument();
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

  it('filtra por estado, manda el filtro al BFF y vuelve a la primera página', async () => {
    const queries: URLSearchParams[] = [];
    servidor.use(bffCompras(undefined, queries));
    const { router } = renderApp('/compras?pagina=2');
    await screen.findByText('12 compras · Página 2 de 2');

    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'Cancelada');
    expect(await screen.findByText('1 compra · Página 1 de 1')).toBeInTheDocument();
    expect(Object.fromEntries(queries.at(-1)!)).toEqual({
      page: '1',
      limit: '10',
      estado: 'CANCELADA',
    });
    expect(router.state.location.search).toBe('?estado=CANCELADA');
  });

  it('filtra por rango de fechas, combinable con la paginación', async () => {
    const queries: URLSearchParams[] = [];
    servidor.use(bffCompras(undefined, queries));
    renderApp('/compras');
    await screen.findByText('12 compras · Página 1 de 2');
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-09-20' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-09-25' } });
    expect(await screen.findByText('6 compras · Página 1 de 1')).toBeInTheDocument();
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
    expect(await screen.findByText('12 compras · Página 1 de 2')).toBeInTheDocument();
  });

  it('con hasta anterior a desde, avisa y no consulta', async () => {
    const queries: URLSearchParams[] = [];
    servidor.use(bffCompras(undefined, queries));
    renderApp('/compras?desde=2026-09-20&hasta=2026-09-01');
    expect(await screen.findByRole('alert')).toHaveTextContent(/no puede ser anterior/);
    expect(queries).toEqual([]);
  });

  it('no muestra el filtro por sede', async () => {
    servidor.use(bffCompras());
    renderApp('/compras');
    await screen.findByText('12 compras · Página 1 de 2');
    expect(screen.queryByLabelText(/Sede/)).not.toBeInTheDocument();
  });
});
