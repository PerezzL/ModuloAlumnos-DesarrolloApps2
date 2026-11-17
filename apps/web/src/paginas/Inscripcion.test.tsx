import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { ofertaBase } from '@/test/inscripcion';
import { renderApp } from '@/test/render';
import { BFF, GW, reiniciarCore, servidor } from '@/test/servidor';

const conOferta = (cambios: Partial<ReturnType<typeof ofertaBase>>) =>
  servidor.use(
    http.get(`${BFF}/inscripcion/oferta`, () => HttpResponse.json({ ...ofertaBase(), ...cambios })),
  );

describe('inscripción: oferta', () => {
  beforeEach(() => reiniciarCore(true));

  it('muestra las materias del período con sus comisiones', async () => {
    renderApp('/academico');
    expect(
      await screen.findByRole('heading', { name: 'Oferta del 1° cuatrimestre 2027' }),
    ).toBeInTheDocument();
    const comisiones = screen.getByRole('list', {
      name: 'Comisiones de Algoritmos y Estructuras de Datos',
    });
    expect(within(comisiones).getAllByRole('listitem')).toHaveLength(2);
    expect(within(comisiones).getByText('22/40 inscriptos')).toBeInTheDocument();
    expect(screen.getByText('3.4.074')).toBeInTheDocument();
  });

  it('cada comisión muestra su estado con texto', async () => {
    const oferta = ofertaBase();
    oferta.materias[2]!.comisiones[0]!.estado = 'INSCRIPTO';
    conOferta(oferta);
    renderApp('/academico');
    const ayed = await screen.findByRole('list', {
      name: 'Comisiones de Algoritmos y Estructuras de Datos',
    });
    const [a, b] = within(ayed).getAllByRole('listitem');
    expect(a).toHaveTextContent('Sin cupo');
    expect(b).toHaveTextContent('Con cupo');
    expect(
      screen.getByRole('list', { name: 'Comisiones de Sistemas Operativos' }),
    ).toHaveTextContent('Inscripto');
  });

  it('una materia bloqueada dice qué correlativas faltan y de qué tipo', async () => {
    renderApp('/academico');
    const faltantes = await screen.findByRole('list', { name: 'Correlativas que te faltan' });
    expect(
      within(faltantes)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      'Te falta regularizar Desarrollo de Aplicaciones I',
      'Te falta aprobar Bases de Datos I',
    ]);
    expect(
      screen.getByRole('list', { name: 'Comisiones de Desarrollo de Aplicaciones II' }),
    ).toHaveTextContent('Bloqueada');
  });

  it('con la inscripción abierta, dice hasta cuándo', async () => {
    renderApp('/academico');
    expect(await screen.findByText('La inscripción está abierta')).toBeInTheDocument();
    expect(screen.getByText(/hasta el 18 de diciembre de 2026/)).toBeInTheDocument();
  });

  it('con la inscripción por abrir, pantalla propia con las fechas y sin la oferta', async () => {
    conOferta({
      inscripcionAbierta: false,
      inscripcionDesde: '2030-02-15T12:00:00.000Z',
      inscripcionHasta: '2030-03-01T02:59:59.000Z',
    });
    renderApp('/academico');
    expect(
      await screen.findByText('El período de inscripción no está abierto'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /La inscripción del 1° cuatrimestre 2027 abre el 15 de febrero de 2030.* y cierra el 28 de febrero de 2030/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Sistemas Operativos')).not.toBeInTheDocument();
    expect(screen.queryByText('La inscripción está abierta')).not.toBeInTheDocument();
  });

  it('con la inscripción ya cerrada, dice cuándo cerró', async () => {
    conOferta({
      inscripcionAbierta: false,
      inscripcionDesde: '2020-02-15T12:00:00.000Z',
      inscripcionHasta: '2020-03-01T02:59:59.000Z',
    });
    renderApp('/academico');
    expect(
      await screen.findByText(
        /La inscripción del 1° cuatrimestre 2027 cerró el 29 de febrero de 2020/,
      ),
    ).toBeInTheDocument();
  });

  it('cerrada y sin fechas, lo dice igual', async () => {
    const { inscripcionDesde: _d, inscripcionHasta: _h, ...sinFechas } = ofertaBase();
    servidor.use(
      http.get(`${BFF}/inscripcion/oferta`, () =>
        HttpResponse.json({ ...sinFechas, inscripcionAbierta: false }),
      ),
    );
    renderApp('/academico');
    expect(
      await screen.findByText('Todavía no hay fechas de inscripción para el 1° cuatrimestre 2027.'),
    ).toBeInTheDocument();
  });

  it('muestra día, horario, aula y sede de cada comisión; sin horarios, la comisión igual', async () => {
    renderApp('/academico');
    const so = await screen.findByRole('list', { name: 'Comisiones de Sistemas Operativos' });
    const horarios = within(so).getByRole('list', { name: 'Horarios' });
    expect(
      within(horarios)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Lunes 18:30 a 20:30 · Aula 501', 'Viernes 18:30 a 20:30', 'Sede Monserrat']);
    const ayed = screen.getByRole('list', {
      name: 'Comisiones de Algoritmos y Estructuras de Datos',
    });
    expect(within(ayed).queryByRole('list', { name: 'Horarios' })).not.toBeInTheDocument();
    expect(within(ayed).getByText('Comisión B - Noche')).toBeInTheDocument();
  });

  it('sin materias, estado vacío', async () => {
    conOferta({ materias: [] });
    renderApp('/academico');
    expect(await screen.findByText('No hay materias para inscribirte')).toBeInTheDocument();
  });

  it('sin plan, avisa que no puede mostrar la oferta (y no dice que el plan no tiene materias)', async () => {
    conOferta({ filtradaPorPlan: false, materias: [] });
    renderApp('/academico');
    expect(await screen.findByText(/No pudimos confirmar tu plan/)).toBeInTheDocument();
    expect(screen.queryByText('No hay materias para inscribirte')).not.toBeInTheDocument();
  });

  it('si Gestión Académica no responde, error con reintento', async () => {
    servidor.use(
      http.get(`${BFF}/inscripcion/oferta`, () =>
        HttpResponse.json(
          { title: 'x', status: 503, code: 'UPSTREAM_UNAVAILABLE', modulo: 'GESTION_ACADEMICA' },
          { status: 503 },
        ),
      ),
    );
    renderApp('/academico');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Gestión Académica no está disponible/,
    );
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('inscripción: simulación de inscripción cerrada (solo en desarrollo)', () => {
  beforeEach(() => reiniciarCore(true));

  /** CORE falso simulado: el PUT de /__falso/inscripcion cambia lo que responde la oferta */
  function coreFalso(pedidos: unknown[], responde = 200) {
    let cerrada = false;
    servidor.use(
      http.put(`${GW}/__falso/inscripcion`, async ({ request }) => {
        const cuerpo = (await request.json()) as { cerrada: boolean };
        pedidos.push(cuerpo);
        if (responde !== 200) return new HttpResponse(null, { status: responde });
        cerrada = cuerpo.cerrada;
        return HttpResponse.json(cuerpo);
      }),
      http.get(`${BFF}/inscripcion/oferta`, () =>
        HttpResponse.json({
          ...ofertaBase(),
          inscripcionAbierta: !cerrada,
          ...(cerrada && { inscripcionDesde: '2030-02-15T12:00:00.000Z' }),
        }),
      ),
    );
  }

  it('cierra la inscripción en el CORE falso, recarga la oferta y deja volver a abrirla', async () => {
    const pedidos: unknown[] = [];
    coreFalso(pedidos);
    renderApp('/academico');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Simular inscripción cerrada' }),
    );
    expect(
      await screen.findByText('El período de inscripción no está abierto'),
    ).toBeInTheDocument();
    expect(pedidos).toEqual([{ cerrada: true }]);

    await userEvent.click(screen.getByRole('button', { name: 'Quitar la simulación' }));
    expect(await screen.findByText('La inscripción está abierta')).toBeInTheDocument();
    expect(pedidos).toEqual([{ cerrada: true }, { cerrada: false }]);
  });

  it('si el CORE falso no responde, lo avisa y la pantalla sigue igual', async () => {
    coreFalso([], 404);
    renderApp('/academico');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Simular inscripción cerrada' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/CORE falso/);
    expect(screen.getByText('La inscripción está abierta')).toBeInTheDocument();
  });
});
