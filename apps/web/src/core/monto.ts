/**
 * Importes (`Monto`): string decimal. Nunca se convierten a float: se formatean y validan
 * como texto.
 */

const SIMBOLOS: Record<string, string> = { ARS: '$' };

/** "13500.5" → "$ 13.500,50" */
export function formatearMonto(monto: string, moneda = 'ARS') {
  const negativo = monto.startsWith('-');
  const [enteros = '0', decimales = ''] = monto.replace(/^[-+]/, '').split('.');
  const miles = enteros.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const simbolo = SIMBOLOS[moneda] ?? moneda;
  return `${negativo ? '-' : ''}${simbolo} ${miles},${decimales.padEnd(2, '0').slice(0, 2)}`;
}

/**
 * Lo que escribe el alumno ("5000", "5.000,5", "5000.50") → "5000.50", o null si no es un
 * importe positivo con hasta dos decimales.
 */
export function normalizarMonto(texto: string): string | null {
  const limpio = texto.trim().replace(/\s/g, '');
  let enteros: string;
  let decimales = '';
  const conComa = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(limpio);
  const conPunto = /^(\d+)(?:\.(\d{1,2}))?$/.exec(limpio);
  if (conPunto) {
    enteros = conPunto[1]!;
    decimales = conPunto[2] ?? '';
  } else if (conComa) {
    enteros = conComa[1]!.replace(/\./g, '');
    decimales = conComa[2] ?? '';
  } else {
    return null;
  }
  enteros = enteros.replace(/^0+(?=\d)/, '');
  if (enteros.length > 12) return null;
  const normalizado = `${enteros}.${decimales.padEnd(2, '0')}`;
  return /^0\.00$/.test(normalizado) ? null : normalizado;
}
