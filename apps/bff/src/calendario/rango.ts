/**
 * Rango visible del calendario y fechas en hora de Argentina. Argentina no tiene horario de
 * verano: el offset es siempre -03:00.
 */
export const OFFSET_AR = '-03:00';
const OFFSET_MS = -3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Fechas sin hora, `YYYY-MM-DD`, ambas inclusive. */
export interface Rango {
  desde: string;
  hasta: string;
}

/** `YYYY-MM-DD` → las 00:00 de ese día en Argentina, ISO 8601 con zona */
export const inicioDelDia = (fecha: string) => `${fecha}T00:00:00${OFFSET_AR}`;

/** Suma días a una fecha `YYYY-MM-DD` */
export function sumarDias(fecha: string, dias: number) {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * DIA_MS).toISOString().slice(0, 10);
}

/** Cualquier instante ISO 8601 → el mismo instante expresado en hora de Argentina */
export function aHoraArgentina(iso: string) {
  const local = new Date(Date.parse(iso) + OFFSET_MS).toISOString();
  return `${local.slice(0, 19)}${OFFSET_AR}`;
}

/** Límites del rango en ms: `[desde 00:00, hasta + 1 día 00:00)` en Argentina */
export function limitesMs({ desde, hasta }: Rango) {
  return {
    inicio: Date.parse(inicioDelDia(desde)),
    finExclusivo: Date.parse(inicioDelDia(sumarDias(hasta, 1))),
  };
}

/** Si el intervalo [inicio, fin] (ISO 8601) se solapa con el rango */
export function solapa(rango: Rango, inicio: string, fin: string = inicio) {
  const { inicio: desdeMs, finExclusivo } = limitesMs(rango);
  return Date.parse(inicio) < finExclusivo && Date.parse(fin) >= desdeMs;
}

/** Si el intervalo de días [desde, hasta] (`YYYY-MM-DD`, inclusive) se solapa con el rango */
export const solapaDias = (rango: Rango, desde: string, hasta: string = desde) =>
  desde <= rango.hasta && hasta >= rango.desde;
