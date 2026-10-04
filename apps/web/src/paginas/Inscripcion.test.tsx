import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { ofertaBase } from '@/test/inscripcion';
import { renderApp } from '@/test/render';
import { BFF, reiniciarCore, servidor } from '@/test/servidor';

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

  it('con la inscripción cerrada, lo avisa y muestra la oferta igual', async () => {
    conOferta({ inscripcionAbierta: false });
    renderApp('/academico');
    expect(await screen.findByText('La inscripción está cerrada')).toBeInTheDocument();
    expect(screen.getByText(/del 28 de septiembre de 2026/)).toBeInTheDocument();
    expect(screen.getByText('Sistemas Operativos')).toBeInTheDocument();
  });

  it('sin materias, estado vacío', async () => {
    conOferta({ materias: [] });
    renderApp('/academico');
    expect(await screen.findByText('No hay materias para inscribirte')).toBeInTheDocument();
  });

  it('si la oferta no está filtrada por plan, lo avisa', async () => {
    conOferta({ filtradaPorPlan: false });
    renderApp('/academico');
    expect(await screen.findByText(/No pudimos confirmar tu plan/)).toBeInTheDocument();
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
