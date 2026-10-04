import { render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmarSalida } from './ConfirmarSalida';

describe('ConfirmarSalida', () => {
  it('en StrictMode queda abierto (el doble efecto no lo cierra)', () => {
    const cerrar = vi.fn();
    render(
      <StrictMode>
        <ConfirmarSalida
          destino={{ tipo: 'externo', url: 'https://eventos.test/events/1', portal: 'Eventos' }}
          cerrar={cerrar}
        />
      </StrictMode>,
    );
    expect(screen.getByRole('dialog', { name: /portal de eventos/i })).toBeInTheDocument();
    expect(cerrar).not.toHaveBeenCalled();
  });
});
