/**
 * Fechas del calendario como `YYYY-MM-DD` en hora de Argentina (offset fijo -03:00, sin
 * horario de verano). Trabajar con strings evita que la zona del navegador corra los días.
 */
const OFFSET_MS = -3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

const aMs = (fecha: string) => Date.parse(`${fecha}T00:00:00Z`);
const deMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Fecha de hoy en Argentina */
export const hoy = (ahora: Date = new Date()) => deMs(ahora.getTime() + OFFSET_MS);

/** Día (en Argentina) de un instante ISO 8601 con zona */
export const diaDe = (iso: string) => deMs(Date.parse(iso) + OFFSET_MS);

/** Hora `HH:mm` (en Argentina) de un instante ISO 8601 con zona */
export const horaDe = (iso: string) =>
  new Date(Date.parse(iso) + OFFSET_MS).toISOString().slice(11, 16);

export const sumarDias = (fecha: string, dias: number) => deMs(aMs(fecha) + dias * DIA_MS);

/** 0 = lunes … 6 = domingo */
const diaSemana = (fecha: string) => (new Date(aMs(fecha)).getUTCDay() + 6) % 7;

export const lunesDe = (fecha: string) => sumarDias(fecha, -diaSemana(fecha));

export const esFechaValida = (valor: string | null): valor is string =>
  !!valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) && deMs(aMs(valor)) === valor;

/** Días entre dos fechas, ambas inclusive */
export function diasEntre(desde: string, hasta: string) {
  const dias: string[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) dias.push(d);
  return dias;
}

export type Vista = 'mes' | 'semana';

/**
 * Rango visible: la semana (lunes a domingo) o el mes completo con las semanas de relleno
 * (hasta 42 días, dentro del máximo de 62 del BFF).
 */
export function rangoVisible(vista: Vista, fecha: string) {
  if (vista === 'semana') {
    const desde = lunesDe(fecha);
    return { desde, hasta: sumarDias(desde, 6) };
  }
  const primero = `${fecha.slice(0, 7)}-01`;
  const ultimo = sumarDias(`${mesSiguiente(primero)}`, -1);
  return { desde: lunesDe(primero), hasta: sumarDias(lunesDe(ultimo), 6) };
}

/** Primer día del mes siguiente */
function mesSiguiente(primero: string) {
  const [anio, mes] = primero.split('-').map(Number) as [number, number];
  return mes === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
}

/** Fecha de referencia del período anterior o siguiente */
export function moverPeriodo(vista: Vista, fecha: string, sentido: 1 | -1) {
  if (vista === 'semana') return sumarDias(fecha, 7 * sentido);
  const primero = `${fecha.slice(0, 7)}-01`;
  return sentido === 1 ? mesSiguiente(primero) : `${sumarDias(primero, -1).slice(0, 7)}-01`;
}

const formato = (opciones: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', ...opciones });

/** "octubre de 2026" */
export const nombreMes = (fecha: string) =>
  formato({ month: 'long', year: 'numeric' }).format(aMs(fecha));

/** "lunes 5 de octubre" */
export const nombreDia = (fecha: string) =>
  formato({ weekday: 'long', day: 'numeric', month: 'long' }).format(aMs(fecha));

/** "5 oct." */
export const diaCorto = (fecha: string) =>
  formato({ day: 'numeric', month: 'short' }).format(aMs(fecha));
