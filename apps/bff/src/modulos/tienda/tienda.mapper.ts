import type { CompraDetalle, CompraResumen, PaginaCompras } from '@uadenet/api-types';
import type { z } from 'zod';
import { parsearOrigen } from '../comun';
import { Orden, PaginaOrdenes } from './tienda.origen';

/** Nombre de cada sede por `siteId`, según Backoffice */
type Sedes = ReadonlyMap<string, string>;

/** Orden de la Tienda → resumen. Los importes se copian como string, sin pasar por float. */
function aResumen(orden: z.infer<typeof Orden>, sedes: Sedes): CompraResumen {
  return {
    orderId: orden.id,
    fecha: orden.createdAt,
    sede: (orden.siteId && sedes.get(orden.siteId)) ?? null,
    estado: orden.status,
    cantidadProductos: orden.items.reduce((total, i) => total + i.quantity, 0),
    total: orden.total,
  };
}

export function aPaginaCompras(datos: unknown, sedes: Sedes): PaginaCompras {
  const pagina = parsearOrigen('TIENDA', PaginaOrdenes, datos);
  return {
    items: pagina.items.map((o) => aResumen(o, sedes)),
    nextCursor: pagina.nextCursor,
  };
}

/** Importe decimal como texto → entero escalado, con `decimales` dígitos de fracción */
function aEscalado(monto: string, decimales: number): bigint {
  const negativo = monto.startsWith('-');
  const [enteros = '0', fraccion = ''] = monto.replace(/^-/, '').split('.');
  const valor =
    BigInt(enteros) * 10n ** BigInt(decimales) + BigInt(fraccion.padEnd(decimales, '0') || '0');
  return negativo ? -valor : valor;
}

/** Entero escalado → importe decimal como texto */
function deEscalado(valor: bigint, decimales: number): string {
  const escala = 10n ** BigInt(decimales);
  const absoluto = valor < 0n ? -valor : valor;
  const signo = valor < 0n ? '-' : '';
  return `${signo}${absoluto / escala}.${String(absoluto % escala).padStart(decimales, '0')}`;
}

const decimalesDe = (montos: string[]) =>
  Math.max(2, ...montos.map((m) => m.split('.')[1]?.length ?? 0));

/**
 * Suma importes decimales como texto, con enteros grandes: nunca pasa por float.
 * `["1250.5", "1000.00"]` → `"2250.50"` (tantos decimales como el que más tenga, mínimo 2).
 */
export function sumarMontos(montos: string[]): string {
  const decimales = decimalesDe(montos);
  return deEscalado(
    montos.reduce((suma, m) => suma + aEscalado(m, decimales), 0n),
    decimales,
  );
}

/** Importe por una cantidad entera, sin float: `("1250.5", 3)` → `"3751.50"` */
export function multiplicarMonto(monto: string, cantidad: number): string {
  const decimales = decimalesDe([monto]);
  return deEscalado(aEscalado(monto, decimales) * BigInt(cantidad), decimales);
}

/**
 * Orden → detalle. Nombres, imágenes y precios son los congelados por la Tienda al momento de
 * la compra. La Tienda no informa subtotales: el de cada producto es cantidad por precio
 * unitario y el de la compra, la suma de los productos.
 */
export function aCompraDetalle(datos: unknown, sedes: Sedes): CompraDetalle {
  const orden = parsearOrigen('TIENDA', Orden, datos);
  const productos = orden.items.map((i) => ({
    productoId: i.productId,
    nombre: i.productName,
    cantidad: i.quantity,
    precioUnitario: i.unitPrice,
    subtotal: multiplicarMonto(i.unitPrice, i.quantity),
    imagenUrl: i.imageUrl ?? null,
    color: i.color ?? null,
    talle: i.size ?? null,
    sku: i.sku ?? null,
  }));
  return {
    ...aResumen(orden, sedes),
    productos,
    subtotal: sumarMontos(productos.map((p) => p.subtotal)),
  };
}
