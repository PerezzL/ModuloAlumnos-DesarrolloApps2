import { describe, expect, it } from 'vitest';
import { aMovimiento, type TransaccionCore } from './saldo';

const base: TransaccionCore = {
  transactionId: 't-1',
  status: 'POSTED',
  type: 'DEBIT',
  concept: 'STORE_PURCHASE',
  amount: '3500.00',
  currency: 'ARS',
  createdAt: '2026-09-28T16:20:10.000Z',
};

describe('movimiento de saldo de CORE → Movimiento', () => {
  it.each([
    ['TOP_UP', 'Carga de saldo'],
    ['PAYROLL', 'Liquidación de haberes'],
    ['SCHOLARSHIP', 'Beca'],
    ['ADJUSTMENT', 'Ajuste'],
    ['LIBRARY_FINE', 'Multa de biblioteca'],
    ['DINING_RESERVATION', 'Reserva de comedor'],
    ['STORE_PURCHASE', 'Compra en la tienda'],
    ['EVENT_REGISTRATION', 'Inscripción a evento'],
    ['REFUND', 'Reintegro'],
  ])('el concepto %s se muestra como "%s"', (concept, concepto) => {
    expect(aMovimiento({ ...base, concept }).concepto).toBe(concepto);
  });

  it('un concepto que no conocemos se muestra tal cual', () => {
    expect(aMovimiento({ ...base, concept: 'NUEVO' }).concepto).toBe('NUEVO');
  });

  it('un débito es egreso; un crédito o una reversa, ingreso', () => {
    expect(aMovimiento(base).tipo).toBe('EGRESO');
    expect(aMovimiento({ ...base, type: 'CREDIT' }).tipo).toBe('INGRESO');
    expect(aMovimiento({ ...base, type: 'REVERSAL' }).tipo).toBe('INGRESO');
  });

  it('el importe queda como string, sin pasar por float', () => {
    expect(aMovimiento({ ...base, amount: '9007199254740993.01' }).monto).toBe(
      '9007199254740993.01',
    );
  });
});
