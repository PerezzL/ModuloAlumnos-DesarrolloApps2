import { screen, within } from '@testing-library/react';
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
      ['Desarrollo de Aplicaciones I', '2° cuatrimestre 2026', '—', 'Cursando'],
      ['Programación II', '1° cuatrimestre 2026', '—', 'Regular'],
      ['Algoritmos y Estructuras de Datos', '2° cuatrimestre 2025', '—', 'Libre'],
      ['Programación I', '2° cuatrimestre 2025', '8', 'Aprobado'],
    ]);
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
