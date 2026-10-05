import { describe, expect, it } from 'vitest';
import { fixture } from '../../../test/fixtures';
import { ProblemaError } from '../../comun/problema';
import { aCompraDetalle, aPaginaCompras, sumarMontos } from './tienda.mapper';

const pagina = fixture<{ items: Record<string, unknown>[] }>('store/orders-me.provisional.json');
const conPaginacion = { ...pagina, page: 1, limit: 10, total: pagina.items.length };

describe('mapper de Tienda: listado de compras', () => {
  it('cada orden con fecha, sede, estado, cantidad de productos y total', () => {
    const compras = aPaginaCompras(conPaginacion);
    expect(compras).toMatchObject({ page: 1, limit: 10, total: 3 });
    expect(compras.items[0]).toEqual({
      orderId: '93b28f67-e111-4a0d-b857-fdd015c4d3f1',
      fecha: '2026-09-28T16:20:00.000Z',
      sede: 'Monserrat',
      estado: 'COMPLETADA',
      cantidadProductos: 3,
      total: '3500.00',
    });
  });

  it('los importes quedan como string, sin redondeos de float', () => {
    const [orden] = pagina.items;
    const compras = aPaginaCompras({
      ...conPaginacion,
      items: [
        { ...orden, total: '0.30' },
        { ...orden, total: '12345678901234.99' },
      ],
    });
    expect(compras.items.map((c) => c.total)).toEqual(['0.30', '12345678901234.99']);
  });

  it('sin productos en el listado, se omite la cantidad; sin sede, null', () => {
    const { productos: _productos, sede: _sede, ...orden } = pagina.items[0]!;
    const [compra] = aPaginaCompras({ ...conPaginacion, items: [orden] }).items;
    expect(compra).not.toHaveProperty('cantidadProductos');
    expect(compra!.sede).toBeNull();
  });

  it('un importe numérico es 502 de TIENDA', () => {
    const [orden] = pagina.items;
    try {
      aPaginaCompras({ ...conPaginacion, items: [{ ...orden, total: 3500 }] });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ProblemaError);
      expect((e as ProblemaError).aProblema()).toMatchObject({ status: 502, modulo: 'TIENDA' });
    }
  });
});

describe('mapper de Tienda: detalle de una compra', () => {
  it('productos con nombre, cantidad, precio unitario y subtotal; subtotal y total', () => {
    expect(aCompraDetalle(pagina.items[0])).toEqual({
      orderId: '93b28f67-e111-4a0d-b857-fdd015c4d3f1',
      fecha: '2026-09-28T16:20:00.000Z',
      sede: 'Monserrat',
      estado: 'COMPLETADA',
      cantidadProductos: 3,
      productos: [
        {
          productoId: 'p-cuaderno',
          nombre: 'Cuaderno A4 UADE',
          cantidad: 2,
          precioUnitario: '1250.00',
          subtotal: '2500.00',
        },
        {
          productoId: 'p-lapicera',
          nombre: 'Lapicera azul',
          cantidad: 1,
          precioUnitario: '1000.00',
          subtotal: '1000.00',
        },
      ],
      subtotal: '3500.00',
      total: '3500.00',
    });
  });

  it('si la Tienda informa el subtotal de la orden, se usa ese', () => {
    expect(aCompraDetalle({ ...pagina.items[0], subtotal: '3400.00' }).subtotal).toBe('3400.00');
  });

  it('el detalle sin productos es 502 de TIENDA', () => {
    const { productos: _productos, ...orden } = pagina.items[0]!;
    expect(() => aCompraDetalle(orden)).toThrow(ProblemaError);
  });
});

describe('suma de importes sin float', () => {
  it.each([
    [['0.10', '0.20'], '0.30'],
    [['1250.5', '1000.00'], '2250.50'],
    [['99999999999999.99', '0.01'], '100000000000000.00'],
    [['10.005', '0.001'], '10.006'],
    [['-5.00', '2.50'], '-2.50'],
    [[], '0.00'],
  ])('%j → %s', (montos, total) => {
    expect(sumarMontos(montos)).toBe(total);
  });
});
