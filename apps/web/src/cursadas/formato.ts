/** "21 de septiembre de 2026" para una fecha `YYYY-MM-DD`, sin que la zona del navegador corra el día */
export const fechaLarga = (fecha: string) =>
  new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeZone: 'UTC' }).format(
    Date.parse(`${fecha}T00:00:00Z`),
  );

const porcentaje = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

/** 87.5 → "87,5 %" */
export const formatearPorcentaje = (valor: number) => `${porcentaje.format(valor)} %`;
