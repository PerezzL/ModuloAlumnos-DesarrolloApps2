import { describe, expect, it } from 'vitest';
import { fixture } from '../../../test/fixtures';
import { ProblemaError } from '../../comun/problema';
import { aPaginaCompras } from './tienda.mapper';

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
