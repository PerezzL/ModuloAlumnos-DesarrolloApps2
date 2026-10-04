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

  it('vista semanal: los ítems de todo el día van sin hora', async () => {
    reiniciarCore(true);
    const pedidos = calendarioQueResponde();
    renderApp('/calendario?vista=semana&fecha=2026-10-07');

    const dia5 = await screen.findByRole('listitem', { name: /lunes, 5 de octubre/i });
    expect(within(dia5).getByText(/todo el día/i)).toBeInTheDocument();
    expect(pedidos[0]?.searchParams.get('desde')).toBe('2026-10-05');
    expect(pedidos[0]?.searchParams.get('hasta')).toBe('2026-10-11');
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
