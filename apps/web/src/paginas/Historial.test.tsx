import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { BFF, reiniciarCore, servidor } from '@/test/servidor';

const filas = (tabla: HTMLElement) =>
  within(tabla)
    .getAllByRole('row')
    .slice(1)
    .map((fila) =>
      within(fila)
        .getAllByRole('cell')
        .map((celda) => celda.textContent),
    );

describe('historial académico', () => {
  beforeEach(() => reiniciarCore(true));

  it('tabla con materia, cuatrimestre, nota y situación, en el orden del BFF', async () => {
    renderApp('/mis-cursos');
    const tabla = await screen.findByRole('table', { name: 'Historial académico' });
    expect(filas(tabla)).toEqual([
      ['Programación II', '1° cuatrimestre 2026', '—', 'Regular'],
      ['Algoritmos y Estructuras de Datos', '2° cuatrimestre 2025', '—', 'Libre'],
      ['Programación I', '2° cuatrimestre 2025', '8', 'Aprobado'],
    ]);
  });

  it('las cursadas en curso van aparte y enlazan a su detalle', async () => {
    const { router } = renderApp('/mis-cursos');
    const enCurso = await screen.findByRole('region', { name: 'Cursando ahora' });
    const enlace = within(enCurso).getByRole('link', { name: /Desarrollo de Aplicaciones I/ });
    expect(enlace).toHaveTextContent('2° cuatrimestre 2026 · Cursando');
    const tabla = screen.getByRole('table', { name: 'Historial académico' });
    expect(within(tabla).queryByText('Desarrollo de Aplicaciones I')).not.toBeInTheDocument();
    expect(within(tabla).queryAllByRole('link')).toEqual([]);

    await userEvent.click(enlace);
    expect(router.state.location.pathname).toBe('/alumnos/cursos/curso-desa1');
    expect(
      await screen.findByRole('heading', { name: 'Desarrollo de Aplicaciones I' }),
    ).toBeInTheDocument();
  });

  it('filtra el historial por período y lo guarda en la URL', async () => {
    const { router } = renderApp('/mis-cursos');
    const selector = await screen.findByRole('combobox', { name: 'Período' });
    expect(
      within(selector)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Todos', '1° cuatrimestre 2026', '2° cuatrimestre 2025']);
    await userEvent.selectOptions(selector, '2° cuatrimestre 2025');
    const tabla = screen.getByRole('table', { name: 'Historial académico' });
    expect(filas(tabla).map((f) => f[0])).toEqual([
      'Algoritmos y Estructuras de Datos',
      'Programación I',
    ]);
    expect(router.state.location.search).toBe('?periodo=2025-2');

    await userEvent.selectOptions(selector, 'Todos');
    expect(filas(tabla)).toHaveLength(3);
  });

  it('un período desconocido en la URL muestra todo', async () => {
    renderApp('/mis-cursos?periodo=nada');
    const tabla = await screen.findByRole('table', { name: 'Historial académico' });
    expect(filas(tabla)).toHaveLength(3);
  });

  it('sin cursadas, estado vacío', async () => {
    servidor.use(http.get(`${BFF}/cursadas`, () => HttpResponse.json({ items: [] })));
    renderApp('/mis-cursos');
    expect(await screen.findByText('Todavía no cursaste materias')).toBeInTheDocument();
  });

  it('si Gestión Académica no responde, error con reintento', async () => {
    servidor.use(
      http.get(`${BFF}/cursadas`, () =>
        HttpResponse.json(
          { title: 'x', status: 504, code: 'UPSTREAM_TIMEOUT', modulo: 'GESTION_ACADEMICA' },
          { status: 504 },
        ),
      ),
    );
    renderApp('/mis-cursos');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Gestión Académica no respondió a tiempo/,
    );
  });
});
