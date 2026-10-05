import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ErrorApi } from '@/api/errores';
import { Cargando } from './Cargando';
import { ErrorCarga } from './ErrorCarga';
import { EstadoVacio } from './EstadoVacio';

describe('estados comunes', () => {
  it('vacío, carga y error se distinguen por rol y texto', () => {
    render(
      <>
        <EstadoVacio titulo="No tenés notificaciones" />
        <Cargando />
        <ErrorCarga
          error={new ErrorApi({ title: 'x', status: 503, code: 'UPSTREAM_UNAVAILABLE' })}
        />
      </>,
    );
    expect(screen.getByText('No tenés notificaciones')).not.toHaveAttribute('role');
    expect(screen.getByRole('status')).toHaveTextContent(/cargando/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/no disponible/i);
  });
});
