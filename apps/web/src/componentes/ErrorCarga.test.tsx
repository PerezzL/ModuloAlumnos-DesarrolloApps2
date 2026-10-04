import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorApi } from '@/api/errores';
import { ErrorCarga } from './ErrorCarga';

const error = new ErrorApi({
  title: 'Módulo no disponible',
  status: 503,
  code: 'UPSTREAM_UNAVAILABLE',
  modulo: 'EVENTOS',
  correlationId: 'corr-42',
});

describe('ErrorCarga', () => {
  it('dice qué módulo falló y muestra el correlationId', () => {
    render(<ErrorCarga error={error} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Eventos no está disponible/);
    expect(screen.getByText('corr-42')).toBeInTheDocument();
  });

  it('ofrece reintentar solo si se lo pide la pantalla', async () => {
    const reintentar = vi.fn();
    const { rerender } = render(<ErrorCarga error={error} />);
    expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument();

    rerender(<ErrorCarga error={error} reintentar={reintentar} />);
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(reintentar).toHaveBeenCalledOnce();
  });
});
