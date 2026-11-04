import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Asistencia, EstadoCursada } from '@uadenet/api-types';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { cursadaDetalleBase } from '@/test/cursadas';
import { renderApp } from '@/test/render';
import { BFF, reiniciarCore, servidor } from '@/test/servidor';

const problema = (status: number, code: string, modulo?: string) =>
  HttpResponse.json({ title: 'x', status, code, ...(modulo && { modulo }) }, { status });

describe('detalle de cursada: encabezado (H16)', () => {
  beforeEach(() => reiniciarCore(true));

  it('materia, comisión, cuatrimestre y situación', async () => {
    renderApp('/alumnos/cursos/curso-desa1');
    expect(
      await screen.findByRole('heading', { name: 'Desarrollo de Aplicaciones I' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Comisión A - Noche · 2° cuatrimestre 2026')).toBeInTheDocument();
    expect(screen.getByText('Situación:').parentElement).toHaveTextContent('Cursando');
  });

  it('sin comisión, muestra solo el cuatrimestre', async () => {
    const { comision: _c, ...sinComision } = cursadaDetalleBase();
    servidor.use(http.get(`${BFF}/cursadas/:cursoId`, () => HttpResponse.json(sinComision)));
    renderApp('/alumnos/cursos/curso-desa1');
    expect(await screen.findByText('2° cuatrimestre 2026')).toBeInTheDocument();
  });

  it('un curso en el que no está inscripto muestra "no encontrada"', async () => {
    servidor.use(
      http.get(`${BFF}/cursadas/:cursoId`, () =>
        problema(404, 'CURSADA_NO_ENCONTRADA', 'GESTION_ACADEMICA'),
      ),
    );
    renderApp('/alumnos/cursos/de-otro');
    expect(await screen.findByText('No encontramos esa cursada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a mis cursos' })).toBeInTheDocument();
  });

  it('si Gestión Académica no responde, error de toda la pantalla con reintento', async () => {
    servidor.use(
      http.get(`${BFF}/cursadas/:cursoId`, () =>
        problema(503, 'UPSTREAM_UNAVAILABLE', 'GESTION_ACADEMICA'),
      ),
    );
    renderApp('/alumnos/cursos/curso-desa1');
    expect(await screen.findByRole('alert')).toHaveTextContent(/Gestión Académica/);
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('detalle de cursada: asistencia (H17)', () => {
  beforeEach(() => reiniciarCore(true));

  it('clases dictadas, presentes, justificadas, ausentes y porcentaje, con las clases por fecha', async () => {
    renderApp('/alumnos/cursos/curso-desa1');
    const seccion = await screen.findByRole('region', { name: 'Asistencia' });
    const dato = (titulo: string) => within(seccion).getByText(titulo).nextSibling;
    expect(dato('Clases dictadas')).toHaveTextContent('4');
    expect(dato('Presentes')).toHaveTextContent('2');
    expect(dato('Justificadas')).toHaveTextContent('1');
    expect(dato('Ausentes')).toHaveTextContent('1');
    expect(dato('Porcentaje')).toHaveTextContent('75 %');
    const clases = within(within(seccion).getByRole('list', { name: 'Clases' })).getAllByRole(
      'listitem',
    );
    expect(clases.map((c) => c.textContent)).toEqual([
      '12 de agosto de 2026Presente',
      '19 de agosto de 2026Ausente',
      '26 de agosto de 2026JustificadaCertificado médico',
      '2 de septiembre de 2026Presente',
      '9 de septiembre de 2026Sin registrar',
    ]);
  });

  it('sin clases dictadas, estado vacío y no un 0 %', async () => {
    servidor.use(
      http.get(`${BFF}/cursadas/:cursoId`, () =>
        HttpResponse.json({
          ...cursadaDetalleBase(),
          asistencia: {
            clasesDictadas: 0,
            presentes: 0,
            justificadas: 0,
            ausentes: 0,
            porcentaje: 0,
            porcentajeMinimo: 75,
            condicion: 'REGULAR',
            clases: [],
          },
        }),
      ),
    );
    renderApp('/alumnos/cursos/curso-desa1');
    const seccion = await screen.findByRole('region', { name: 'Asistencia' });
    expect(within(seccion).getByText('Todavía no hubo clases')).toBeInTheDocument();
    expect(within(seccion).queryByText(/0 %/)).not.toBeInTheDocument();
  });
});

describe('detalle de cursada: condición por asistencia (H18)', () => {
  beforeEach(() => reiniciarCore(true));

  const conAsistencia = (cambios: Partial<Asistencia>, estado: EstadoCursada = 'CURSANDO') => {
    const base = cursadaDetalleBase();
    servidor.use(
      http.get(`${BFF}/cursadas/:cursoId`, () =>
        HttpResponse.json({ ...base, estado, asistencia: { ...base.asistencia!, ...cambios } }),
      ),
    );
  };
  const indicador = async () => {
    await screen.findByRole('region', { name: 'Asistencia' });
    return screen.getByLabelText('Condición por asistencia');
  };

  it('lejos del mínimo, el porcentaje contra el mínimo, sin alerta', async () => {
    conAsistencia({ porcentaje: 90, porcentajeMinimo: 75 });
    renderApp('/alumnos/cursos/curso-desa1');
    const condicion = await indicador();
    expect(condicion).toHaveRole('status');
    expect(condicion).toHaveTextContent('Tu asistencia está al día');
    expect(condicion).toHaveTextContent(
      'Tenés 90 % de asistencia; el mínimo para quedar regular es 75 %.',
    );
  });

  it('cerca del mínimo, alerta', async () => {
    conAsistencia({ porcentaje: 77.5, porcentajeMinimo: 75 });
    renderApp('/alumnos/cursos/curso-desa1');
    const condicion = await indicador();
    expect(condicion).toHaveRole('alert');
    expect(condicion).toHaveTextContent('Estás cerca del mínimo de asistencia');
  });

  it('el mínimo es el que informa el Módulo 2, no una constante', async () => {
    conAsistencia({ porcentaje: 77.5, porcentajeMinimo: 60 });
    renderApp('/alumnos/cursos/curso-desa1');
    const condicion = await indicador();
    expect(condicion).toHaveRole('status');
    expect(condicion).toHaveTextContent('el mínimo para quedar regular es 60 %');
  });

  it('libre por asistencia según el Módulo 2: no se calcula en el portal', async () => {
    conAsistencia({ porcentaje: 80, porcentajeMinimo: 75, condicion: 'LIBRE' });
    renderApp('/alumnos/cursos/curso-desa1');
    const condicion = await indicador();
    expect(condicion).toHaveRole('alert');
    expect(condicion).toHaveTextContent('Quedaste libre por asistencia');
  });

  it('si la materia ya figura libre en Gestión Académica, se muestra eso', async () => {
    conAsistencia({ condicion: 'LIBRE' }, 'LIBRE');
    renderApp('/alumnos/cursos/curso-ayed');
    const condicion = await indicador();
    expect(condicion).toHaveTextContent('Quedaste libre en esta materia');
    expect(condicion).not.toHaveTextContent(/por asistencia/);
  });
});

describe('detalle de cursada: notas (H19)', () => {
  beforeEach(() => reiniciarCore(true));

  it('examen, instancia, fecha, nota y resultado; sin nota todavía, pendiente', async () => {
    renderApp('/alumnos/cursos/curso-desa1');
    const tabla = await screen.findByRole('table', { name: 'Notas de la cursada' });
    const filas = within(tabla)
      .getAllByRole('row')
      .slice(1)
      .map((f) =>
        within(f)
          .getAllByRole('cell')
          .map((c) => c.textContent),
      );
    expect(filas).toEqual([
      ['1er parcial', 'Parcial', '23 de septiembre de 2026', '4', 'Desaprobado'],
      ['Recuperatorio 1er parcial', 'Recuperatorio', '28 de octubre de 2026', '—', 'Pendiente'],
    ]);
    expect(screen.getByText('Promedio:')).toHaveTextContent('Promedio: 4');
  });

  it('una instancia que no conocemos se muestra con un guion; sin promedio, no se muestra', async () => {
    const base = cursadaDetalleBase();
    servidor.use(
      http.get(`${BFF}/cursadas/:cursoId`, () =>
        HttpResponse.json({
          ...base,
          notas: [{ ...base.notas![0]!, instancia: null, titulo: 'Exposición oral' }],
          promedio: null,
        }),
      ),
    );
    renderApp('/alumnos/cursos/curso-desa1');
    const tabla = await screen.findByRole('table', { name: 'Notas de la cursada' });
    expect(within(tabla).getAllByRole('cell')[1]).toHaveTextContent('—');
    expect(screen.queryByText('Promedio:')).not.toBeInTheDocument();
  });

  it('cada nota enlaza a su detalle', async () => {
    const { router } = renderApp('/alumnos/cursos/curso-desa1');
    await userEvent.click(await screen.findByRole('link', { name: '1er parcial' }));
    expect(router.state.location.pathname).toBe('/cursadas/curso-desa1/notas/exam-desa1-p1');
  });

  it('sin notas cargadas, estado vacío', async () => {
    servidor.use(
      http.get(`${BFF}/cursadas/:cursoId`, () =>
        HttpResponse.json({ ...cursadaDetalleBase(), notas: [] }),
      ),
    );
    renderApp('/alumnos/cursos/curso-desa1');
    const seccion = await screen.findByRole('region', { name: 'Notas' });
    expect(within(seccion).getByText('Todavía no tenés notas')).toBeInTheDocument();
  });
});

describe('detalle de cursada sin el Módulo 2 (H20)', () => {
  beforeEach(() => reiniciarCore(true));

  const sinDocente = {
    ...cursadaDetalleBase(),
    asistencia: null,
    notas: null,
    fuentesConError: ['DOCENTE'],
  };

  it('muestra el encabezado y un aviso en asistencia y en notas', async () => {
    servidor.use(http.get(`${BFF}/cursadas/:cursoId`, () => HttpResponse.json(sinDocente)));
    renderApp('/alumnos/cursos/curso-desa1');
    expect(
      await screen.findByRole('heading', { name: 'Desarrollo de Aplicaciones I' }),
    ).toBeInTheDocument();
    const asistencia = screen.getByRole('region', { name: 'Asistencia' });
    const notas = screen.getByRole('region', { name: 'Notas' });
    expect(within(asistencia).getByRole('alert')).toHaveTextContent(
      'No pudimos cargar tu asistencia',
    );
    expect(within(notas).getByRole('alert')).toHaveTextContent('No pudimos cargar tus notas');
  });

  it('si falla solo una parte, la otra se muestra', async () => {
    servidor.use(
      http.get(`${BFF}/cursadas/:cursoId`, () =>
        HttpResponse.json({ ...cursadaDetalleBase(), notas: null, fuentesConError: ['DOCENTE'] }),
      ),
    );
    renderApp('/alumnos/cursos/curso-desa1');
    const asistencia = await screen.findByRole('region', { name: 'Asistencia' });
    expect(within(asistencia).queryByRole('alert', { name: /no pudimos/i })).toBeNull();
    expect(within(asistencia).getByText('Clases dictadas')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Notas' })).getByRole('alert'),
    ).toHaveTextContent('No pudimos cargar tus notas');
  });

  it('reintentar vuelve a pedir el detalle y muestra lo que cargó', async () => {
    let pedidos = 0;
    servidor.use(
      http.get(`${BFF}/cursadas/:cursoId`, () =>
        HttpResponse.json(++pedidos === 1 ? sinDocente : cursadaDetalleBase()),
      ),
    );
    renderApp('/alumnos/cursos/curso-desa1');
    const asistencia = await screen.findByRole('region', { name: 'Asistencia' });
    await userEvent.click(within(asistencia).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('table', { name: 'Notas de la cursada' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Asistencia' })).getByText('Clases dictadas'),
    ).toBeInTheDocument();
    expect(pedidos).toBe(2);
  });
});
