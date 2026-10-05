import { screen, within } from '@testing-library/react';
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

  it('clases dictadas, presentes, ausentes y porcentaje, con las clases por fecha', async () => {
    renderApp('/alumnos/cursos/curso-desa1');
    const seccion = await screen.findByRole('region', { name: 'Asistencia' });
    const dato = (titulo: string) => within(seccion).getByText(titulo).nextSibling;
    expect(dato('Clases dictadas')).toHaveTextContent('3');
    expect(dato('Presentes')).toHaveTextContent('2');
    expect(dato('Ausentes')).toHaveTextContent('1');
    expect(dato('Porcentaje')).toHaveTextContent('66,7 %');
    const clases = within(within(seccion).getByRole('list', { name: 'Clases' })).getAllByRole(
      'listitem',
    );
    expect(clases.map((c) => c.textContent)).toEqual([
      '12 de agosto de 2026Presente',
      '19 de agosto de 2026Ausente',
      '26 de agosto de 2026Presente',
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
            ausentes: 0,
            porcentaje: 0,
            limiteInasistencias: null,
            inasistenciasRestantes: null,
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

describe('detalle de cursada: faltas restantes (H18)', () => {
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
    return screen.queryByLabelText('Faltas');
  };

  it('con límite informado, cuántas faltas quedan, sin alerta', async () => {
    conAsistencia({ limiteInasistencias: 4, inasistenciasRestantes: 3 });
    renderApp('/alumnos/cursos/curso-desa1');
    const faltas = await indicador();
    expect(faltas).toHaveRole('status');
    expect(faltas).toHaveTextContent('Te quedan 3 faltas antes de quedar libre');
    expect(faltas).toHaveTextContent('El límite es de 4 faltas.');
  });

  it.each([
    [1, 'Te queda 1 falta antes de quedar libre'],
    [0, 'No te quedan faltas disponibles'],
  ])('con %i restantes, alerta', async (restantes, texto) => {
    conAsistencia({ limiteInasistencias: 4, inasistenciasRestantes: restantes });
    renderApp('/alumnos/cursos/curso-desa1');
    const faltas = await indicador();
    expect(faltas).toHaveRole('alert');
    expect(faltas).toHaveTextContent(texto);
  });

  it('sin límite informado, no se muestra el indicador', async () => {
    conAsistencia({ limiteInasistencias: null, inasistenciasRestantes: null });
    renderApp('/alumnos/cursos/curso-desa1');
    expect(await indicador()).toBeNull();
  });

  it('con límite pero sin faltas restantes, tampoco: no se calcula', async () => {
    conAsistencia({ limiteInasistencias: 4, inasistenciasRestantes: null });
    renderApp('/alumnos/cursos/curso-desa1');
    expect(await indicador()).toBeNull();
  });

  it('si ya quedó libre, se muestra ese estado en lugar del indicador', async () => {
    conAsistencia({ limiteInasistencias: 4, inasistenciasRestantes: 0 }, 'LIBRE');
    renderApp('/alumnos/cursos/curso-ayed');
    const faltas = await indicador();
    expect(faltas).toHaveTextContent('Quedaste libre en esta materia');
    expect(faltas).not.toHaveTextContent(/te quedan|disponibles/i);
  });
});
