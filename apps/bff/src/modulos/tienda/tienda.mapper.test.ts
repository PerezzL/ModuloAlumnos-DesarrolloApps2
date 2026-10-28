import { describe, expect, it } from 'vitest';
import { fixture } from '../../../test/fixtures';
import { ProblemaError } from '../../comun/problema';
import { aCompraDetalle, aPaginaCompras, multiplicarMonto, sumarMontos } from './tienda.mapper';

const pagina = fixture<{ items: Record<string, unknown>[]; nextCursor: null }>(
  'store/orders-me.json',
);
const sedes = new Map([
  ['3e9b0a12-55cc-4d77-9a01-6b2f8c4e1d90', 'Sede Monserrat'],
  ['7b1d3f5a-9c2e-4a6b-8d0f-2e4a6c8b0d12', 'Sede Recoleta'],
]);

describe('mapper de Tienda: listado de compras', () => {
  it('cada orden con fecha, sede de Backoffice, estado, cantidad de productos y total', () => {
    const compras = aPaginaCompras({ ...pagina, nextCursor: 'abc' }, sedes);
    expect(compras.nextCursor).toBe('abc');
    expect(compras.items.map((c) => c.estado)).toEqual(['COMPLETED', 'COMPLETED', 'FAILED']);
    expect(compras.items[0]).toEqual({
      orderId: '93b28f67-e111-4a0d-b857-fdd015c4d3f1',
      fecha: '2026-09-28T16:20:00.000Z',
      sede: 'Sede Monserrat',
      estado: 'COMPLETED',
      cantidadProductos: 3,
      total: '3500.00',
    });
  });

  it('sin el nombre de la sede (Backoffice caído o sede desconocida), sede null', () => {
    const [compra] = aPaginaCompras(pagina, new Map()).items;
    expect(compra!.sede).toBeNull();
    const [sinSede] = aPaginaCompras(
      { ...pagina, items: [{ ...pagina.items[0], siteId: null }] },
      sedes,
    ).items;
    expect(sinSede!.sede).toBeNull();
  });

  it('los importes quedan como string, sin redondeos de float', () => {
    const [orden] = pagina.items;
    const compras = aPaginaCompras(
      {
        ...pagina,
        items: [
          { ...orden, total: '0.30' },
          { ...orden, total: '12345678901234.99' },
        ],
      },
      sedes,
    );
    expect(compras.items.map((c) => c.total)).toEqual(['0.30', '12345678901234.99']);
  });

  it('un importe numérico es 502 de TIENDA', () => {
    const [orden] = pagina.items;
    try {
      aPaginaCompras({ ...pagina, items: [{ ...orden, total: 3500 }] }, sedes);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ProblemaError);
      expect((e as ProblemaError).aProblema()).toMatchObject({ status: 502, modulo: 'TIENDA' });
    }
  });

  it('sin nextCursor es 502 de TIENDA', () => {
    const { nextCursor: _n, ...sinCursor } = pagina;
    expect(() => aPaginaCompras(sinCursor, sedes)).toThrow(ProblemaError);
  });
});

describe('mapper de Tienda: detalle de una compra', () => {
  it('productos con nombre, cantidad, precio unitario, subtotal calculado e imagen', () => {
    expect(aCompraDetalle(pagina.items[0], sedes)).toEqual({
      orderId: '93b28f67-e111-4a0d-b857-fdd015c4d3f1',
      fecha: '2026-09-28T16:20:00.000Z',
      sede: 'Sede Monserrat',
      estado: 'COMPLETED',
      cantidadProductos: 3,
      productos: [
        {
          productoId: '0f3a8c1e-6b2d-4e9f-a1c7-5d8b2e4f6a90',
          nombre: 'Cuaderno A4 UADE',
          cantidad: 2,
          precioUnitario: '1250.00',
          subtotal: '2500.00',
          imagenUrl: 'https://tienda.uadenet.test/assets/products/cuaderno-a4.png',
          color: null,
          talle: null,
          sku: null,
        },
        {
          productoId: '4c7e1a9b-2d5f-4b8e-9a3c-6f1d8e2b5a74',
          nombre: 'Lapicera azul',
          cantidad: 1,
          precioUnitario: '1000.00',
          subtotal: '1000.00',
          imagenUrl: 'https://tienda.uadenet.test/assets/products/lapicera-azul.png',
          color: null,
          talle: null,
          sku: null,
        },
      ],
      subtotal: '3500.00',
      total: '3500.00',
    });
  });

  it('una variante trae color, talle y sku; sin imageUrl, imagen null', () => {
    const orden = pagina.items[1] as { items: Record<string, unknown>[] };
    const { imageUrl: _i, ...sinImagen } = orden.items[0]!;
    const [producto] = aCompraDetalle({ ...orden, items: [sinImagen] }, sedes).productos;
    expect(producto).toMatchObject({
      color: 'Azul institucional',
      talle: 'M',
      sku: 'BUZO-AZUL-M',
      imagenUrl: null,
    });
  });

  it('la orden sin ítems es 502 de TIENDA', () => {
    const { items: _items, ...orden } = pagina.items[0]!;
    expect(() => aCompraDetalle(orden, sedes)).toThrow(ProblemaError);
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

describe('importe por cantidad sin float', () => {
  it.each([
    ['0.10', 3, '0.30'],
    ['1250.5', 3, '3751.50'],
    ['8500.00', 1, '8500.00'],
    ['99999999999999.99', 10, '999999999999999.90'],
    ['10.005', 2, '20.010'],
  ])('%s × %i → %s', (monto, cantidad, total) => {
    expect(multiplicarMonto(monto, cantidad)).toBe(total);
  });
});
