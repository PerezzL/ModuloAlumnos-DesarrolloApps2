import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Misma profundidad desde src/ y desde dist/: apps/core-falso/{src,dist}/
const DIR = fileURLToPath(new URL('../../../packages/fixtures/', import.meta.url));

/**
 * Lee una fixture de `packages/fixtures`. Se lee en cada llamada, así cada uso recibe una
 * copia propia y el estado en memoria nunca modifica el archivo.
 */
export function fixture<T>(ruta: string): T {
  return JSON.parse(readFileSync(`${DIR}${ruta}`, 'utf8')) as T;
}
