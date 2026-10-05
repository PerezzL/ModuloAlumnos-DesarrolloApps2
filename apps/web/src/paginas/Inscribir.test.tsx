import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { ofertaBase } from '@/test/inscripcion';
import { renderApp } from '@/test/render';
import { BFF, reiniciarCore, servidor } from '@/test/servidor';

const SO = 'Inscribirme en Sistemas Operativos, comisión A - Noche';
const AYED_B = 'Inscribirme en Algoritmos y Estructuras de Datos, comisión B - Noche';

/** POST /inscripciones que registra los pedidos y responde lo que diga `responder` */
function registrarPosts(responder: () => Response | Promise<Response> = () => creada()) {
  const pedidos: unknown[] = [];
  servidor.use(
    http.post(`${BFF}/inscripciones`, async ({ request }) => {
      pedidos.push(await request.json());
      return responder();
    }),
  );
  return pedidos;
}

const creada = (cursoId = 'curso-so-a') =>
  HttpResponse.json({ id: 'insc-1', cursoId, estado: 'INSCRIPTO' }, { status: 201 });

describe('inscripción: inscribirse en una comisión', () => {
  beforeEach(() => reiniciarCore(true));

  it('pide confirmación con materia y comisión, y recién entonces envía', async () => {
    const pedidos = registrarPosts();
    renderApp('/academico');
    await userEvent.click(await screen.findByRole('button', { name: SO }));

    const confirmacion = screen.getByRole('group', { name: 'Confirmar inscripción' });
    expect(confirmacion).toHaveTextContent(
      '¿Confirmás la inscripción en Sistemas Operativos, comisión A - Noche?',
    );
    expect(pedidos).toEqual([]);

    await userEvent.click(
      within(confirmacion).getByRole('button', { name: 'Confirmar inscripción' }),
    );
    await waitFor(() => expect(pedidos).toEqual([{ cursoId: 'curso-so-a' }]));
  });

  it('cancelar no envía nada', async () => {
    const pedidos = registrarPosts();
    renderApp('/academico');
    await userEvent.click(await screen.findByRole('button', { name: SO }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('group', { name: 'Confirmar inscripción' })).not.toBeInTheDocument();
    expect(pedidos).toEqual([]);
  });

  it('con éxito, la comisión pasa a Inscripto sin recargar y suma un inscripto', async () => {
    registrarPosts();
    renderApp('/academico');
    await userEvent.click(await screen.findByRole('button', { name: SO }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar inscripción' }));

    const so = screen.getByRole('list', { name: 'Comisiones de Sistemas Operativos' });
    await waitFor(() => expect(so).toHaveTextContent('Inscripto'));
    expect(so).toHaveTextContent('11/45 inscriptos');
    expect(screen.queryByRole('button', { name: SO })).not.toBeInTheDocument();
    expect(await screen.findByText('Inscripción registrada.')).toBeInTheDocument();
  });

  it('mientras se envía, los botones quedan deshabilitados (sin doble clic)', async () => {
    const pedidos = registrarPosts(async () => {
      await delay(50);
      return creada();
    });
    renderApp('/academico');
    await userEvent.click(await screen.findByRole('button', { name: SO }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar inscripción' }));
    expect(screen.getByRole('button', { name: AYED_B })).toBeDisabled();
    expect(await screen.findByText('Inscripción registrada.')).toBeInTheDocument();
    expect(pedidos).toHaveLength(1);
  });

  it('ante un error de red avisa, no reintenta solo y deja reintentar a mano', async () => {
    let fallar = true;
    const pedidos = registrarPosts(() => (fallar ? HttpResponse.error() : creada()));
    renderApp('/academico');
    await userEvent.click(await screen.findByRole('button', { name: SO }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar inscripción' }));

    expect(await screen.findByText(/no sabemos si la inscripción llegó/)).toBeInTheDocument();
    expect(pedidos).toHaveLength(1);

    fallar = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Inscripción registrada.')).toBeInTheDocument();
    expect(pedidos).toHaveLength(2);
  });

  it('solo se ofrece inscribirse en comisiones con cupo', async () => {
    renderApp('/academico');
    const ayed = await screen.findByRole('list', {
      name: 'Comisiones de Algoritmos y Estructuras de Datos',
    });
    const [sinCupo, conCupo] = within(ayed).getAllByRole('listitem');
    expect(within(sinCupo!).queryByRole('button')).not.toBeInTheDocument();
    expect(within(conCupo!).getByRole('button', { name: AYED_B })).toBeInTheDocument();
    const bloqueada = screen.getByRole('list', {
      name: 'Comisiones de Desarrollo de Aplicaciones II',
    });
    expect(within(bloqueada).queryByRole('button')).not.toBeInTheDocument();
  });

  it('con una comisión inscripta, no ofrece otra de la misma materia', async () => {
    const oferta = ofertaBase();
    oferta.materias[0]!.comisiones[0]!.estado = 'INSCRIPTO';
    servidor.use(http.get(`${BFF}/inscripcion/oferta`, () => HttpResponse.json(oferta)));
    renderApp('/academico');
    await screen.findByRole('button', { name: SO });
    expect(screen.queryByRole('button', { name: AYED_B })).not.toBeInTheDocument();
  });

  it('con la inscripción cerrada no hay botones', async () => {
    servidor.use(
      http.get(`${BFF}/inscripcion/oferta`, () =>
        HttpResponse.json({ ...ofertaBase(), inscripcionAbierta: false }),
      ),
    );
    renderApp('/academico');
    await screen.findByText('La inscripción está cerrada');
    expect(screen.queryByRole('button', { name: /Inscribirme/ })).not.toBeInTheDocument();
  });
});

describe('inscripción: rechazos', () => {
  beforeEach(() => reiniciarCore(true));

  const rechazar = (code: string, extra: object = {}) =>
    registrarPosts(() =>
      HttpResponse.json(
        {
          title: 'Inscripción rechazada',
          status: 409,
          code,
          modulo: 'GESTION_ACADEMICA',
          ...extra,
        },
        { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );

  const intentar = async () => {
    await userEvent.click(await screen.findByRole('button', { name: SO }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar inscripción' }));
    return screen.findByRole('alert');
  };

  it('explica el motivo y no ofrece reintentar', async () => {
    rechazar('SIN_CUPO');
    renderApp('/academico');
    const alerta = await intentar();
    expect(alerta).toHaveTextContent('La comisión se quedó sin cupo');
    expect(within(alerta).queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  });

  it('con CORRELATIVIDAD_FALTANTE lista las correlativas que faltan', async () => {
    rechazar('CORRELATIVIDAD_FALTANTE', {
      correlativasFaltantes: [
        { asignaturaId: 'asig-prog2', nombre: 'Programación II', tipo: 'REGULAR' },
      ],
    });
    renderApp('/academico');
    const alerta = await intentar();
    expect(within(alerta).getByRole('list', { name: 'Correlativas que faltan' })).toHaveTextContent(
      'Programación II (regularizar)',
    );
  });

  it('un código desconocido muestra un mensaje genérico', async () => {
    rechazar('ALGO_NUEVO');
    renderApp('/academico');
    expect(await intentar()).toHaveTextContent('No pudimos inscribirte');
    expect(screen.getByRole('heading', { name: /Oferta del/ })).toBeInTheDocument();
  });
});
