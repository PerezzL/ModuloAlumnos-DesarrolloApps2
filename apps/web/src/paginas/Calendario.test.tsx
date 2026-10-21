import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { calendarioOctubre } from '@/test/calendario';
import { renderApp } from '@/test/render';
import { BFF, reiniciarCore, servidor } from '@/test/servidor';

function calendarioQueResponde() {
  const pedidos: URL[] = [];
  servidor.use(
    http.get(`${BFF}/calendario`, ({ request }) => {
      pedidos.push(new URL(request.url));
      return HttpResponse.json(calendarioOctubre);
    }),
  );
  return pedidos;
}

describe('calendario', () => {
  it('vista mensual: pide el mes con las semanas de relleno y muestra los ítems por día', async () => {
    reiniciarCore(true);
    const pedidos = calendarioQueResponde();
    renderApp('/calendario?vista=mes&fecha=2026-10-15');

    const dia8 = await screen.findByRole('listitem', { name: /jueves, 8 de octubre/i });
    expect(within(dia8).getByText('Jornada de Desarrollo de Software')).toBeInTheDocument();
    expect(within(dia8).getByText('18:00')).toBeInTheDocument();
    expect(pedidos[0]?.searchParams.get('desde')).toBe('2026-09-28');
    expect(pedidos[0]?.searchParams.get('hasta')).toBe('2026-11-01');

    // El turno de examen ocupa los cinco días de la ventana
    for (const d of [19, 20, 21, 22, 23]) {
      const dia = screen.getByRole('listitem', { name: new RegExp(`, ${d} de octubre`, 'i') });
      expect(within(dia).getByText('Mesa especial de octubre 2026')).toBeInTheDocument();
    }
  });

  it('la categoría se anuncia con texto, no solo con color', async () => {
    reiniciarCore(true);
    calendarioQueResponde();
    renderApp('/calendario?vista=mes&fecha=2026-10-15');
    const dia5 = await screen.findByRole('listitem', { name: /lunes, 5 de octubre/i });
    expect(within(dia5).getByText(/turno de comedor:/i)).toBeInTheDocument();
  });

  it('vista semanal: los ítems con hora muestran inicio y fin', async () => {
    reiniciarCore(true);
    const pedidos = calendarioQueResponde();
    renderApp('/calendario?vista=semana&fecha=2026-10-07');

    const dia5 = await screen.findByRole('listitem', { name: /lunes, 5 de octubre/i });
    expect(within(dia5).getByText(/12:00–12:45/)).toBeInTheDocument();
    expect(pedidos[0]?.searchParams.get('desde')).toBe('2026-10-05');
    expect(pedidos[0]?.searchParams.get('hasta')).toBe('2026-10-11');
  });

  it('vista semanal: los ítems de todo el día van sin hora', async () => {
    reiniciarCore(true);
    calendarioQueResponde();
    renderApp('/calendario?vista=semana&fecha=2026-10-21');

    const dia19 = await screen.findByRole('listitem', { name: /lunes, 19 de octubre/i });
    expect(within(dia19).getByText(/todo el día/i)).toBeInTheDocument();
  });

  it('navega al mes siguiente y pide el rango nuevo', async () => {
    reiniciarCore(true);
    const pedidos = calendarioQueResponde();
    const { router } = renderApp('/calendario?vista=mes&fecha=2026-10-15');
    await screen.findByRole('heading', { name: /octubre de 2026/i });

    await userEvent.click(screen.getByRole('button', { name: /mes siguiente/i }));
    expect(await screen.findByRole('heading', { name: /noviembre de 2026/i })).toBeInTheDocument();
    expect(router.state.location.search).toContain('fecha=2026-11-01');
    expect(pedidos.at(-1)?.searchParams.get('desde')).toBe('2026-10-26');
  });

  it('un evento de varios días muestra la hora solo el primer día', async () => {
    reiniciarCore(true);
    servidor.use(
      http.get(`${BFF}/calendario`, () =>
        HttpResponse.json({
          ...calendarioOctubre,
          items: [
            {
              id: 'EVENTO:semana',
              categoria: 'EVENTO',
              titulo: 'Semana de la Ingeniería',
              inicio: '2026-09-30T15:00:00-03:00',
              fin: '2026-10-02T20:00:00-03:00',
              todoElDia: false,
              lugar: null,
            },
          ],
        }),
      ),
    );
    renderApp('/calendario?vista=mes&fecha=2026-10-15');
    const dia30 = await screen.findByRole('listitem', { name: /miércoles, 30 de septiembre/i });
    const dia1 = screen.getByRole('listitem', { name: /jueves, 1 de octubre/i });
    expect(within(dia30).getByText('15:00')).toBeInTheDocument();
    expect(within(dia1).queryByText('15:00')).not.toBeInTheDocument();
    expect(within(dia1).getByText('(continúa)')).toBeInTheDocument();
  });

  it('en la vista semanal, un evento de varios días muestra el rango completo', async () => {
    reiniciarCore(true);
    servidor.use(
      http.get(`${BFF}/calendario`, () =>
        HttpResponse.json({
          ...calendarioOctubre,
          items: [
            {
              id: 'EVENTO:semana',
              categoria: 'EVENTO',
              titulo: 'Semana de la Ingeniería',
              inicio: '2026-09-30T15:00:00-03:00',
              fin: '2026-10-02T20:00:00-03:00',
              todoElDia: false,
              lugar: null,
            },
          ],
        }),
      ),
    );
    renderApp('/calendario?vista=semana&fecha=2026-10-01');
    const dia1 = await screen.findByRole('listitem', { name: /jueves, 1 de octubre/i });
    expect(within(dia1).getByText(/30 sept\.? 15:00 – 2 oct\.? 20:00/)).toBeInTheDocument();
  });

  it('sin ítems muestra el estado vacío', async () => {
    reiniciarCore(true);
    servidor.use(
      http.get(`${BFF}/calendario`, () => HttpResponse.json({ ...calendarioOctubre, items: [] })),
    );
    renderApp('/calendario?vista=mes&fecha=2026-10-15');
    expect(await screen.findByText(/no tenés nada agendado/i)).toBeInTheDocument();
  });
});

describe('filtros del calendario', () => {
  it('por defecto pide todas; al sacar una categoría pide solo las otras', async () => {
    reiniciarCore(true);
    const pedidos = calendarioQueResponde();
    renderApp('/calendario?vista=mes&fecha=2026-10-15');
    const comedor = await screen.findByRole('button', { name: 'Comedor', pressed: true });
    expect(pedidos[0]?.searchParams.has('categorias')).toBe(false);

    await userEvent.click(comedor);
    expect(
      await screen.findByRole('button', { name: 'Comedor', pressed: false }),
    ).toBeInTheDocument();
    expect(pedidos.at(-1)?.searchParams.get('categorias')).toBe('EXAMEN,EVENTO');
  });

  it('el filtro se mantiene al cambiar de mes', async () => {
    reiniciarCore(true);
    const pedidos = calendarioQueResponde();
    renderApp('/calendario?vista=mes&fecha=2026-10-15&cat=EVENTO');
    await screen.findByRole('heading', { name: /octubre de 2026/i });

    await userEvent.click(screen.getByRole('button', { name: /mes siguiente/i }));
    await screen.findByRole('heading', { name: /noviembre de 2026/i });
    expect(screen.getByRole('button', { name: 'Eventos', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exámenes', pressed: false })).toBeInTheDocument();
    expect(pedidos.at(-1)?.searchParams.get('categorias')).toBe('EVENTO');
  });

  it('sin ninguna categoría no pide nada y lo explica', async () => {
    reiniciarCore(true);
    const pedidos = calendarioQueResponde();
    renderApp('/calendario?vista=mes&fecha=2026-10-15&cat=');
    expect(await screen.findByText(/no elegiste ninguna categoría/i)).toBeInTheDocument();
    expect(pedidos).toHaveLength(0);
  });
});

describe('calendario con fuentes caídas', () => {
  const conExamenCaido = {
    items: calendarioOctubre.items.filter((i) => i.categoria !== 'EXAMEN'),
    fuentes: [
      { categoria: 'COMEDOR', estado: 'OK' },
      { categoria: 'EVENTO', estado: 'OK' },
      { categoria: 'EXAMEN', estado: 'ERROR', code: 'UPSTREAM_UNAVAILABLE' },
    ],
  };

  it('muestra lo que cargó, nombra la categoría que falló y reintenta solo esa', async () => {
    reiniciarCore(true);
    const pedidos: URL[] = [];
    servidor.use(
      http.get(`${BFF}/calendario`, ({ request }) => {
        const url = new URL(request.url);
        pedidos.push(url);
        if (url.searchParams.get('categorias') === 'EXAMEN') {
          return HttpResponse.json({
            items: calendarioOctubre.items.filter((i) => i.categoria === 'EXAMEN'),
            fuentes: [{ categoria: 'EXAMEN', estado: 'OK' }],
          });
        }
        return HttpResponse.json(conExamenCaido);
      }),
    );
    renderApp('/calendario?vista=mes&fecha=2026-10-15');

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent(/Exámenes: el servicio no está disponible/);
    expect(screen.getAllByText('Turno de comedor').length).toBeGreaterThan(0);
    expect(screen.queryByText('Mesa especial de octubre 2026')).not.toBeInTheDocument();

    await userEvent.click(within(aviso).getByRole('button', { name: /reintentar/i }));
    const dia20 = await screen.findByRole('listitem', { name: /martes, 20 de octubre/i });
    expect(await within(dia20).findByText('Mesa especial de octubre 2026')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(pedidos.at(-1)?.searchParams.get('categorias')).toBe('EXAMEN');
    expect(screen.getAllByText('Turno de comedor').length).toBeGreaterThan(0);
  });

  it('si el reintento también falla, lo dice y deja lo que había', async () => {
    reiniciarCore(true);
    servidor.use(
      http.get(`${BFF}/calendario`, ({ request }) =>
        new URL(request.url).searchParams.has('categorias')
          ? HttpResponse.json(
              { title: 'x', status: 503, code: 'UPSTREAM_UNAVAILABLE' },
              { status: 503 },
            )
          : HttpResponse.json(conExamenCaido),
      ),
    );
    renderApp('/calendario?vista=mes&fecha=2026-10-15');
    await userEvent.click(await screen.findByRole('button', { name: /reintentar/i }));
    expect(await screen.findByText(/el reintento tampoco funcionó/i)).toBeInTheDocument();
    expect(screen.getAllByText('Turno de comedor').length).toBeGreaterThan(0);
  });

  it('si fallan las tres, es un error de toda la pantalla', async () => {
    reiniciarCore(true);
    servidor.use(
      http.get(`${BFF}/calendario`, () =>
        HttpResponse.json(
          { title: 'Calendario no disponible', status: 503, code: 'UPSTREAM_UNAVAILABLE' },
          { status: 503 },
        ),
      ),
    );
    renderApp('/calendario?vista=mes&fecha=2026-10-15');
    expect(await screen.findByRole('alert')).toHaveTextContent(/el calendario no está disponible/i);
    expect(screen.queryByRole('listitem', { name: /8 de octubre/i })).not.toBeInTheDocument();
  });
});
