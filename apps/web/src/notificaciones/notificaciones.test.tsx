import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/render';
import { core, notificaciones, reiniciarCore } from '@/test/servidor';
import { ultimoSocket } from '@/test/socket';

async function abrirPanel(ruta = '/') {
  reiniciarCore(true);
  const utils = renderApp(ruta);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /notificaciones, 2 sin leer/i }));
  const panel = await screen.findByRole('region', { name: /panel de notificaciones/i });
  await within(panel).findAllByRole('listitem');
  return { ...utils, user, panel };
}

const nueva = {
  id: 'n-nueva',
  type: 'TEACHER_EXAM_RESULT_PUBLISHED',
  title: 'Se publicó tu nota de Física I',
  message: '2do parcial: 9 (aprobado)',
  actionUrl: '/student/courses/curso-fis1/exams/exam-p2',
  readAt: null as string | null,
  createdAt: '2026-10-04T15:00:00.000Z',
};

describe('centro de notificaciones (H21)', () => {
  it('panel desde la campana, de la más nueva a la más vieja, con leídas y no leídas', async () => {
    const { panel } = await abrirPanel();
    const items = within(panel).getAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringMatching(/Se acerca tu evento.*Recordatorio de evento\. No leída/),
      expect.stringMatching(/sanción de biblioteca.*No leída/),
      expect.stringMatching(/Bases de Datos I.*Nota publicada\. Leída/),
    ]);
  });

  it('un type desconocido usa la variante genérica', async () => {
    reiniciarCore(true);
    notificaciones.items = [{ ...nueva, id: 'x', type: 'ALGO_NUEVO', title: 'Aviso' }];
    renderApp('/notificaciones');
    expect(await screen.findByText(/^Notificación\. No leída/)).toBeInTheDocument();
  });

  it('sin notificaciones muestra el estado vacío', async () => {
    reiniciarCore(true);
    notificaciones.items = [];
    renderApp('/notificaciones');
    expect(await screen.findByText(/no tenés notificaciones/i)).toBeInTheDocument();
  });

  it('la página pagina con "ver más"', async () => {
    reiniciarCore(true);
    notificaciones.items = Array.from({ length: 12 }, (_, i) => ({
      ...nueva,
      id: `n-${i}`,
      title: `Notificación ${i}`,
      readAt: '2026-10-05T10:00:00.000Z',
    }));
    renderApp('/notificaciones');
    expect(await screen.findAllByRole('listitem')).toHaveLength(10);
    await userEvent.click(screen.getByRole('button', { name: /ver más/i }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(12));
  });
});

describe('contador de no leídas (H22)', () => {
  it('sin no leídas no hay badge', async () => {
    reiniciarCore(true);
    for (const n of notificaciones.items) n.readAt = '2026-10-05T10:00:00.000Z';
    renderApp('/');
    expect(await screen.findByRole('button', { name: /^notificaciones$/i })).toBeInTheDocument();
  });
});

describe('tiempo real (H23)', () => {
  it('se conecta a /notifications de CORE con el access token', async () => {
    reiniciarCore(true);
    const { sesion } = renderApp('/');
    await screen.findByRole('button', { name: /notificaciones, 2 sin leer/i });
    const socket = ultimoSocket()!;
    expect(socket.url).toBe('http://gateway.test/notifications');
    expect(socket.tokenDelHandshake()).toBe(sesion.token());
  });

  it('notification.created se suma al listado, sube el contador y muestra un aviso', async () => {
    const { panel } = await abrirPanel();
    // Como CORE: se guarda antes de emitirse
    notificaciones.items.unshift(nueva);
    act(() => ultimoSocket()!.simular('notification.created', nueva));

    expect(await screen.findByRole('button', { name: /3 sin leer/i })).toBeInTheDocument();
    expect(within(panel).getAllByRole('listitem')[0]).toHaveTextContent(/Física I/);
    expect(screen.getAllByText('Se publicó tu nota de Física I')).toHaveLength(2);
  });

  it('al cerrar sesión se cierra el socket', async () => {
    reiniciarCore(true);
    renderApp('/');
    await screen.findByRole('button', { name: /notificaciones, 2 sin leer/i });
    const socket = ultimoSocket()!;
    await userEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }));
    await waitFor(() => expect(socket.cerrado).toBe(true));
  });
});

describe('reconexión (H24)', () => {
  it('al reconectar pide de nuevo por REST: aparece la que llegó sin conexión, sin duplicar', async () => {
    const { panel } = await abrirPanel();
    const socket = ultimoSocket()!;
    act(() => socket.simularConexion());

    // Se corta el socket y CORE guarda una notificación que no llega en tiempo real
    act(() => socket.simularCorte());
    notificaciones.items.unshift(nueva);

    act(() => socket.simularConexion());
    expect(await within(panel).findByText(/Física I/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /3 sin leer/i })).toBeInTheDocument();

    // La misma notificación llega tarde por el socket: no se duplica
    act(() => socket.simular('notification.created', nueva));
    expect(within(panel).getAllByText(/Física I/)).toHaveLength(1);
    expect(screen.getByRole('button', { name: /3 sin leer/i })).toBeInTheDocument();
  });

  it('si CORE rechaza el token del socket, renueva la sesión y reconecta', async () => {
    reiniciarCore(true);
    renderApp('/');
    await screen.findByRole('button', { name: /notificaciones, 2 sin leer/i });
    const socket = ultimoSocket()!;
    const refreshes = core.refreshes;

    act(() => socket.simularRechazo());
    await waitFor(() => expect(socket.reconexionesPedidas).toBe(1));
    expect(core.refreshes).toBe(refreshes + 1);
    expect(socket.tokenDelHandshake()).toBe(`token-refrescado-${core.refreshes}`);
  });
});

describe('marcar como leídas (H25)', () => {
  it('abrir una notificación la marca como leída y baja el contador', async () => {
    const { panel, user } = await abrirPanel();
    // La sanción abre el aviso de salida; se cancela
    await user.click(within(panel).getByRole('button', { name: /sanción de biblioteca/i }));
    await user.click(await screen.findByRole('button', { name: /cancelar/i }));

    expect(
      await screen.findByRole('button', { name: /notificaciones, 1 sin leer/i }),
    ).toBeInTheDocument();
    expect(notificaciones.items.find((n) => n.id === 'n-sancion')?.readAt).toEqual(
      expect.any(String),
    );
  });

  it('"marcar todas como leídas" deja el contador en cero', async () => {
    const { panel, user } = await abrirPanel();
    await user.click(within(panel).getByRole('button', { name: /marcar todas/i }));
    expect(await screen.findByRole('button', { name: /^notificaciones$/i })).toBeInTheDocument();
    expect(notificaciones.items.every((n) => n.readAt != null)).toBe(true);
  });

  it('si CORE responde con error, se revierte y se avisa', async () => {
    const { panel, user } = await abrirPanel();
    notificaciones.fallarEscrituras = true;
    await user.click(within(panel).getByRole('button', { name: /marcar todas/i }));

    expect(await screen.findByText(/no pudimos marcar las notificaciones/i)).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /notificaciones, 2 sin leer/i }),
    ).toBeInTheDocument();
    expect(within(panel).getAllByText(/No leída/)).toHaveLength(2);
  });
});

describe('destino al tocar una notificación (H26, H28, H29)', () => {
  it('la nota de un examen lleva a la pantalla propia del detalle', async () => {
    const { panel, user, router } = await abrirPanel();
    await user.click(within(panel).getByRole('button', { name: /bases de datos i/i }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/cursadas/curso-bd1/notas/exam-p1'),
    );
    expect(
      screen.queryByRole('region', { name: /panel de notificaciones/i }),
    ).not.toBeInTheDocument();
  });

  it('un actionUrl que no se reconoce la marca como leída y no navega', async () => {
    reiniciarCore(true);
    notificaciones.items = [{ ...nueva, actionUrl: 'https://otro-sitio.test/x' }];
    const { router } = renderApp('/notificaciones');
    await userEvent.click(await screen.findByRole('button', { name: /física i/i }));
    await waitFor(() => expect(notificaciones.items[0]?.readAt).toEqual(expect.any(String)));
    expect(router.state.location.pathname).toBe('/notificaciones');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each([
    [
      'sanción',
      /sanción de biblioteca/i,
      'Biblioteca',
      'https://biblioteca.test/library/loan-1/penalty',
    ],
    ['recordatorio', /se acerca tu evento/i, 'Eventos', 'https://eventos.test/events/ev-1'],
  ])(
    'la %s avisa que sale del portal y abre la URL configurada',
    async (_c, nombre, portal, url) => {
      const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
      const { panel, user } = await abrirPanel();
      await user.click(within(panel).getByRole('button', { name: nombre }));

      const dialogo = await screen.findByRole('dialog', {
        name: `Vas a salir al portal de ${portal}`,
      });
      expect(dialogo).toHaveTextContent(/no comparte tu sesión/i);
      await user.click(within(dialogo).getByRole('button', { name: `Ir a ${portal}` }));
      expect(abrir).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer');
      abrir.mockRestore();
    },
  );
});
