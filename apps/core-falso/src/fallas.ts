import { esModulo, type Modulo } from './config.js';

export const TIPOS_FALLA = ['caido', 'lento', 'invalido'] as const;
export type TipoFalla = (typeof TIPOS_FALLA)[number];

export interface Falla {
  tipo: TipoFalla;
  /** Solo para `lento`. Sin valor, la demora supera el timeout del Gateway (504). */
  demoraMs?: number;
}

const esTipo = (t: string): t is TipoFalla => (TIPOS_FALLA as readonly string[]).includes(t);

/** Valida una falla que llega de afuera (variable de entorno o endpoint de prueba). */
export function validarFalla(tipo: unknown, demoraMs?: unknown): Falla {
  if (typeof tipo !== 'string' || !esTipo(tipo)) {
    throw new Error(`Tipo de falla inválido: ${String(tipo)} (${TIPOS_FALLA.join(', ')})`);
  }
  if (demoraMs === undefined || demoraMs === '') return { tipo };
  const ms = Number(demoraMs);
  if (tipo !== 'lento' || !Number.isInteger(ms) || ms < 0) {
    throw new Error(`Demora inválida para ${tipo}: ${String(demoraMs)}`);
  }
  return { tipo, demoraMs: ms };
}

/**
 * Fallas simuladas por módulo, para mostrar la falla parcial sin apagar nada de verdad.
 * Se cargan de `CORE_FALLAS` y se cambian en caliente con `/__falso/fallas`.
 */
export class Fallas {
  private readonly activas = new Map<Modulo, Falla>();

  constructor(private readonly inicial = '') {
    this.reiniciar();
  }

  /** `dining:caido,events:lento:3000` → una falla por módulo */
  private static parsear(texto: string) {
    return texto
      .split(',')
      .map((parte) => parte.trim())
      .filter(Boolean)
      .map((parte) => {
        const [modulo = '', tipo, demora] = parte.split(':');
        if (!esModulo(modulo)) throw new Error(`Módulo desconocido en CORE_FALLAS: ${modulo}`);
        return [modulo, validarFalla(tipo, demora)] as const;
      });
  }

  de(modulo: Modulo) {
    return this.activas.get(modulo);
  }

  poner(modulo: Modulo, falla: Falla) {
    this.activas.set(modulo, falla);
  }

  quitar(modulo: Modulo) {
    this.activas.delete(modulo);
  }

  todas() {
    return Object.fromEntries(this.activas);
  }

  /** Vuelve a las fallas de `CORE_FALLAS` */
  reiniciar() {
    this.activas.clear();
    for (const [modulo, falla] of Fallas.parsear(this.inicial)) this.activas.set(modulo, falla);
  }
}
