import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { notaDetalleBase } from '@/test/cursadas';
import { renderApp } from '@/test/render';
import { BFF, reiniciarCore, servidor } from '@/test/servidor';

const NOTA = `${BFF}/cursadas/:cursoId/notas/:notaId`;
const dato = (titulo: string) => screen.getByText(titulo).nextSibling;

describe('detalle de la nota de un examen (H27)', () => {
  beforeEach(() => reiniciarCore(true));

  it('materia, comisión, instancia, fecha, nota, resultado y docente', async () => {
    renderApp('/cursadas/curso-desa1/notas/exam-desa1-p1');
    expect(await screen.findByRole('heading', { name: '1er parcial' })).toBeInTheDocument();
    expect(
      screen.getByText('Desarrollo de Aplicaciones I · Comisión A - Noche'),
    ).toBeInTheDocument();
    expect(dato('Nota')).toHaveTextContent('4');
    expect(dato('Resultado')).toHaveTextContent('Desaprobado');
    expect(dato('Instancia')).toHaveTextContent('Parcial');
    expect(dato('Fecha')).toHaveTextContent('23 de septiembre de 2026');
    expect(dato('Docente')).toHaveTextContent('Martín Sosa');
  });

  it('sin docente, no se muestra esa parte', async () => {
    servidor.use(http.get(NOTA, () => HttpResponse.json({ ...notaDetalleBase(), docente: null })));
    renderApp('/cursadas/curso-desa1/notas/exam-desa1-p1');
    await screen.findByRole('heading', { name: '1er parcial' });
    expect(screen.queryByText('Docente')).not.toBeInTheDocument();
  });

  it('una instancia que no conocemos se muestra con un guion', async () => {
    servidor.use(
      http.get(NOTA, () =>
        HttpResponse.json({ ...notaDetalleBase(), instancia: null, titulo: 'Exposición oral' }),
      ),
    );
    renderApp('/cursadas/curso-desa1/notas/exam-desa1-p1');
    await screen.findByRole('heading', { name: 'Exposición oral' });
    expect(dato('Instancia')).toHaveTextContent('—');
  });

  it('un examen sin nota todavía figura pendiente', async () => {
    servidor.use(
      http.get(NOTA, () => {
        const { resultado: _r, ...sinResultado } = notaDetalleBase();
        return HttpResponse.json({ ...sinResultado, nota: null });
      }),
    );
    renderApp('/cursadas/curso-desa1/notas/exam-desa1-p1');
    await screen.findByRole('heading', { name: '1er parcial' });
    expect(dato('Nota')).toHaveTextContent('—');
    expect(dato('Resultado')).toHaveTextContent('Pendiente');
  });

  it('se llega desde las notas de la cursada y vuelve a ella', async () => {
    const { router } = renderApp('/alumnos/cursos/curso-desa1');
    await userEvent.click(await screen.findByRole('link', { name: '1er parcial' }));
    expect(await screen.findByRole('heading', { name: '1er parcial' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Volver a la cursada' }));
    expect(router.state.location.pathname).toBe('/alumnos/cursos/curso-desa1');
  });

  it('se llega desde la notificación de examen, con los ids de su actionUrl', async () => {
    let pedido: Record<string, unknown> = {};
    servidor.use(
      http.get(NOTA, ({ params }) => {
        pedido = { ...params };
        return HttpResponse.json({
          ...notaDetalleBase(),
          cursoId: params.cursoId,
          notaId: params.notaId,
          titulo: '2do parcial',
          asignatura: { id: 'asig-bd1', nombre: 'Bases de Datos I' },
        });
      }),
    );
    renderApp('/');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /notificaciones, 2 sin leer/i }));
    const panel = await screen.findByRole('region', { name: /panel de notificaciones/i });
    await user.click(await within(panel).findByRole('button', { name: /bases de datos i/i }));
    expect(await screen.findByRole('heading', { name: '2do parcial' })).toBeInTheDocument();
    expect(pedido).toEqual({ cursoId: 'curso-bd1', notaId: 'exam-p1' });
  });

  it('una nota inexistente o ajena muestra "no encontrada"', async () => {
    servidor.use(
      http.get(NOTA, () =>
        HttpResponse.json(
          { title: 'x', status: 404, code: 'NOTA_NO_ENCONTRADA', modulo: 'DOCENTE' },
          { status: 404 },
        ),
      ),
    );
    renderApp('/cursadas/curso-desa1/notas/de-otro');
    expect(await screen.findByText('No encontramos esa nota')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a la cursada' })).toHaveAttribute(
      'href',
      '/alumnos/cursos/curso-desa1',
    );
  });

  it('si Docente no responde, error con reintento', async () => {
    servidor.use(
      http.get(NOTA, () =>
        HttpResponse.json(
          { title: 'x', status: 503, code: 'UPSTREAM_UNAVAILABLE', modulo: 'DOCENTE' },
          { status: 503 },
        ),
      ),
    );
    renderApp('/cursadas/curso-desa1/notas/exam-desa1-p1');
    expect(await screen.findByRole('alert')).toHaveTextContent(/Docente/);
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
